import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_COMMUNITY_QR_SEEDS, DEFAULT_COMMUNITY_INVITE_BASE_URL, buildCommunityInviteUrl, generateCommunityInviteQrSvg } from '../services/communityInvite.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const outputDir = path.join(workspaceRoot, 'public', 'qr-codes');
const docsPath = path.join(workspaceRoot, 'docs', 'COMMUNITY_QR_CODES.md');
const baseUrl = process.env.AERA_PUBLIC_APP_URL || DEFAULT_COMMUNITY_INVITE_BASE_URL;

await mkdir(outputDir, { recursive: true });

const rows = [];

for (const seed of DEMO_COMMUNITY_QR_SEEDS) {
  const inviteUrl = buildCommunityInviteUrl(seed.communityId, baseUrl);
  const svg = await generateCommunityInviteQrSvg(seed.communityId, baseUrl);
  const fileName = `${seed.communityId.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-join.svg`;
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, svg, 'utf8');
  rows.push({ ...seed, inviteUrl, fileName });
}

const markdown = `# Community QR Codes\n\nGenerated join QR codes for current demo organizations and churches.\n\nBase app URL: ${baseUrl}\n\n| Community | Type | Code | Invite URL | QR Asset |\n|---|---|---|---|---|\n${rows.map((row) => `| ${row.name} | ${row.type} | ${row.communityId} | ${row.inviteUrl} | public/qr-codes/${row.fileName} |`).join('\n')}\n`;

await writeFile(docsPath, markdown, 'utf8');

console.log(`Generated ${rows.length} QR codes in ${outputDir}`);
console.log(`Wrote manifest to ${docsPath}`);