import React from 'react';
import { ViewState } from '../types';
import { BuildKitView } from './BuildKitView';

export const ReadinessView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  return <BuildKitView setView={setView} />;
};
