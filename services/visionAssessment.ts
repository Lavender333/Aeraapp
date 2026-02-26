type DamageType = 'STRUCTURAL' | 'FLOOD' | 'ELECTRICAL' | 'ACCESS' | string;

export type DamageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  label: string;
};

export type VisionAssessmentResult = {
  summary: string;
  suggestedSeverity: 1 | 2 | 3;
  confidence: number;
  findings: string[];
  riskSignals: string[];
  damageRegions: DamageRegion[];
  model: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeDamageType = (damageType: DamageType): 'STRUCTURAL' | 'FLOOD' | 'ELECTRICAL' | 'ACCESS' => {
  const key = String(damageType || 'ACCESS').toUpperCase();
  if (key === 'STRUCTURAL' || key === 'FLOOD' || key === 'ELECTRICAL' || key === 'ACCESS') return key;
  return 'ACCESS';
};

const loadImage = async (imageDataUrl: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = imageDataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load image for analysis.'));
  });
  return image;
};

const scoreLabelForType = (damageType: ReturnType<typeof normalizeDamageType>, score: number) => {
  if (damageType === 'STRUCTURAL') {
    if (score > 0.82) return 'probable fracture zone';
    if (score > 0.66) return 'shingle/deck anomaly';
    return 'surface disruption';
  }
  if (damageType === 'FLOOD') {
    if (score > 0.82) return 'standing water concentration';
    if (score > 0.66) return 'moisture pattern';
    return 'wet-area indicator';
  }
  if (damageType === 'ELECTRICAL') {
    if (score > 0.82) return 'high utility-risk hotspot';
    if (score > 0.66) return 'possible arc/heat marker';
    return 'utility anomaly';
  }
  if (score > 0.82) return 'major route blockage';
  if (score > 0.66) return 'obstruction cluster';
  return 'access disruption';
};

export async function analyzeDamagePhoto(imageDataUrl: string, damageType: DamageType): Promise<VisionAssessmentResult> {
  const kind = normalizeDamageType(damageType);
  const image = await loadImage(imageDataUrl);

  const maxDimension = 320;
  const scale = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(32, Math.round((image.width || 1) * scale));
  const height = Math.max(32, Math.round((image.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable.');
  ctx.drawImage(image, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const pixelCount = Math.max(1, width * height);
  const luma = new Float32Array(pixelCount);

  let brightnessSum = 0;
  let blueDominanceSum = 0;
  let warmSignalSum = 0;
  let highlightPixels = 0;

  for (let index = 0, p = 0; index < data.length; index += 4, p += 1) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luma[p] = y;
    brightnessSum += y;

    const blueDom = clamp((blue - Math.max(red, green)) / 255, 0, 1);
    blueDominanceSum += blueDom;

    const warm = clamp(((red + green) / 2 - blue) / 255, 0, 1);
    warmSignalSum += warm;

    if (red > 240 || green > 240 || blue > 240) highlightPixels += 1;
  }

  const averageBrightness = brightnessSum / pixelCount;
  const averageBlueDominance = blueDominanceSum / pixelCount;
  const averageWarmSignal = warmSignalSum / pixelCount;
  const highlightRatio = highlightPixels / pixelCount;

  const gradients = new Float32Array(pixelCount);
  let gradientSum = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = luma[i + 1] - luma[i - 1];
      const gy = luma[i + width] - luma[i - width];
      const mag = Math.sqrt(gx * gx + gy * gy);
      gradients[i] = mag;
      gradientSum += mag;
    }
  }
  const averageGradient = gradientSum / Math.max(1, (width - 2) * (height - 2));

  const gridCols = 6;
  const gridRows = 6;
  const cellWidth = width / gridCols;
  const cellHeight = height / gridRows;

  const damageRegions: DamageRegion[] = [];

  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      const xStart = Math.floor(col * cellWidth);
      const yStart = Math.floor(row * cellHeight);
      const xEnd = Math.min(width, Math.floor((col + 1) * cellWidth));
      const yEnd = Math.min(height, Math.floor((row + 1) * cellHeight));

      let cellBrightness = 0;
      let cellGradient = 0;
      let cellBlue = 0;
      let cellWarm = 0;
      let samples = 0;

      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
          const i = y * width + x;
          const di = i * 4;
          const red = data[di];
          const green = data[di + 1];
          const blue = data[di + 2];

          cellBrightness += luma[i];
          cellGradient += gradients[i];
          cellBlue += clamp((blue - Math.max(red, green)) / 255, 0, 1);
          cellWarm += clamp(((red + green) / 2 - blue) / 255, 0, 1);
          samples += 1;
        }
      }

      if (!samples) continue;

      const b = cellBrightness / samples;
      const g = cellGradient / samples;
      const blueSignal = cellBlue / samples;
      const warmSignal = cellWarm / samples;

      const darkness = clamp((110 - b) / 110, 0, 1);
      const texture = clamp(g / Math.max(1, averageGradient * 2.2), 0, 1);
      const moisture = clamp(blueSignal / Math.max(0.15, averageBlueDominance * 1.8), 0, 1);
      const thermal = clamp(warmSignal / Math.max(0.15, averageWarmSignal * 1.8), 0, 1);

      const weightedScore =
        kind === 'STRUCTURAL'
          ? 0.5 * texture + 0.35 * darkness + 0.15 * thermal
          : kind === 'FLOOD'
            ? 0.5 * moisture + 0.3 * darkness + 0.2 * texture
            : kind === 'ELECTRICAL'
              ? 0.45 * thermal + 0.35 * texture + 0.2 * (1 - darkness)
              : 0.4 * texture + 0.35 * darkness + 0.25 * moisture;

      if (weightedScore >= 0.48) {
        damageRegions.push({
          x: clamp(xStart / width, 0, 1),
          y: clamp(yStart / height, 0, 1),
          width: clamp((xEnd - xStart) / width, 0.05, 1),
          height: clamp((yEnd - yStart) / height, 0.05, 1),
          score: Number(clamp(weightedScore, 0, 1).toFixed(2)),
          label: scoreLabelForType(kind, weightedScore),
        });
      }
    }
  }

  const topRegions = damageRegions.sort((a, b) => b.score - a.score).slice(0, 4);
  const maxRegionScore = topRegions.length ? topRegions[0].score : 0;

  const globalRisk = clamp(
    0.35 * clamp(averageGradient / 28, 0, 1) +
      0.25 * clamp((120 - averageBrightness) / 120, 0, 1) +
      0.2 * averageBlueDominance +
      0.2 * highlightRatio,
    0,
    1
  );

  const severityScore = clamp(globalRisk * 0.55 + maxRegionScore * 0.45 + topRegions.length * 0.04, 0, 1);
  const suggestedSeverity: 1 | 2 | 3 = severityScore >= 0.67 ? 3 : severityScore >= 0.42 ? 2 : 1;
  const confidence = Math.round(clamp(58 + severityScore * 34 + Math.min(topRegions.length, 4) * 2, 45, 97));

  const findings: string[] = [];
  if (topRegions.length) {
    findings.push(`Detected ${topRegions.length} high-interest visual region${topRegions.length > 1 ? 's' : ''}.`);
    findings.push(`Top region score: ${Math.round(topRegions[0].score * 100)}%.`);
  } else {
    findings.push('No high-confidence region segmentation detected; continue with manual notes.');
  }

  if (kind === 'STRUCTURAL') {
    findings.push('Texture-edge clustering suggests potential roofing/structural surface disruption.');
  } else if (kind === 'FLOOD') {
    findings.push('Color/luminance profile suggests probable moisture concentration zones.');
  } else if (kind === 'ELECTRICAL') {
    findings.push('Contrast and warm-spectrum hotspots suggest utility-risk inspection is needed.');
  } else {
    findings.push('Pattern spread suggests route obstruction that should be field-verified.');
  }

  const riskSignals: string[] = [];
  if (topRegions.length >= 3) riskSignals.push('Multiple impacted zones detected');
  if (averageBrightness < 70) riskSignals.push('Low-light capture may hide secondary damage');
  if (highlightRatio > 0.16) riskSignals.push('High glare/overexposure in portions of image');
  if (kind === 'FLOOD' && averageBlueDominance > 0.12) riskSignals.push('Water-like color signature elevated');
  if (kind === 'STRUCTURAL' && averageGradient > 24) riskSignals.push('High edge-fracture density observed');
  if (kind === 'ELECTRICAL' && averageWarmSignal > 0.2) riskSignals.push('Heat/arc-like color profile elevated');

  const summary =
    topRegions.length > 0
      ? `CV scan identified ${topRegions.length} damage hotspot${topRegions.length > 1 ? 's' : ''}; ${topRegions[0].label} is the highest-priority area.`
      : 'CV scan found no strong hotspot segmentation; manual report details remain primary.';

  return {
    summary,
    suggestedSeverity,
    confidence,
    findings,
    riskSignals,
    damageRegions: topRegions,
    model: 'AERA-CV-Lite v1',
  };
}