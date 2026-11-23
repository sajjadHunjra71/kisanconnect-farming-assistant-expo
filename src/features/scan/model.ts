/**
 * On-device leaf model. The real model (react-native-fast-tflite, INT8 TFLite) needs a
 * development build (Phase 4E). In Expo Go and on web the app uses UnavailableModel,
 * so scans go straight to the cloud check.
 */
import type { CropId } from '@/engine';

export type ModelPrediction = {
  /** Top classes for the chosen crop (masked to that crop + "unclear"), highest first. */
  top: { id: string; p: number }[];
  /** Confidence threshold tuned on the validation set (labels.json). */
  threshold: number;
  version: string;
};

export interface DiseaseModel {
  readonly available: boolean;
  readonly version: string | null;
  /** Classify a saved JPEG for one crop. */
  classify(photoUri: string, crop: CropId): Promise<ModelPrediction>;
}

export class UnavailableModel implements DiseaseModel {
  readonly available = false;
  readonly version = null;
  async classify(): Promise<ModelPrediction> {
    throw new Error('On-device model is not available in this build');
  }
}

let current: DiseaseModel = new UnavailableModel();

export function diseaseModel(): DiseaseModel {
  return current;
}

/** Phase 4E: the dev build registers the TFLite model here at start-up. */
export function setDiseaseModel(model: DiseaseModel) {
  current = model;
}
