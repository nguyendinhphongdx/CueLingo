import { create } from 'zustand';

export type SelectableAssistLevel = 4 | 3 | 1 | 0;

interface SettingsState {
  assistLevel: SelectableAssistLevel;
  setAssistLevel: (level: SelectableAssistLevel) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  assistLevel: 4,
  setAssistLevel: (assistLevel) => set({ assistLevel }),
}));
