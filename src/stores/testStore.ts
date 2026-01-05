import { create } from 'zustand';
import type { TestScenario, TestResult, TestReport, Issue, PromptModification } from '@/types';

interface TestStore {
  scenarios: TestScenario[];
  results: TestResult[];
  currentReport: TestReport | null;
  issues: Issue[];
  modifications: PromptModification[];
  isRunning: boolean;
  currentScenarioIndex: number;

  // Loading states for UI persistence across tabs
  isGeneratingScenarios: boolean;
  isFetchingLogs: boolean;

  // Actions
  setScenarios: (scenarios: TestScenario[]) => void;
  addScenario: (scenario: TestScenario) => void;
  updateScenario: (id: string, updates: Partial<TestScenario>) => void;
  removeScenario: (id: string) => void;
  clearScenarios: () => void;

  addResult: (result: TestResult) => void;
  clearResults: () => void;

  setReport: (report: TestReport | null) => void;

  addIssue: (issue: Issue) => void;
  clearIssues: () => void;

  addModification: (modification: PromptModification) => void;
  updateModification: (id: string, updates: Partial<PromptModification>) => void;
  clearModifications: () => void;

  setRunning: (running: boolean) => void;
  setCurrentScenarioIndex: (index: number) => void;

  // Loading state actions
  setGeneratingScenarios: (generating: boolean) => void;
  setFetchingLogs: (fetching: boolean) => void;
}

export const useTestStore = create<TestStore>((set) => ({
  scenarios: [],
  results: [],
  currentReport: null,
  issues: [],
  modifications: [],
  isRunning: false,
  currentScenarioIndex: 0,
  isGeneratingScenarios: false,
  isFetchingLogs: false,

  setScenarios: (scenarios) => set({ scenarios }),

  addScenario: (scenario) =>
    set((state) => ({ scenarios: [...state.scenarios, scenario] })),

  updateScenario: (id, updates) =>
    set((state) => ({
      scenarios: state.scenarios.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeScenario: (id) =>
    set((state) => ({
      scenarios: state.scenarios.filter((s) => s.id !== id),
    })),

  clearScenarios: () => set({ scenarios: [] }),

  addResult: (result) =>
    set((state) => ({ results: [...state.results, result] })),

  clearResults: () => set({ results: [] }),

  setReport: (currentReport) => set({ currentReport }),

  addIssue: (issue) =>
    set((state) => ({ issues: [...state.issues, issue] })),

  clearIssues: () => set({ issues: [] }),

  addModification: (modification) =>
    set((state) => ({ modifications: [...state.modifications, modification] })),

  updateModification: (id, updates) =>
    set((state) => ({
      modifications: state.modifications.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  clearModifications: () => set({ modifications: [] }),

  setRunning: (isRunning) => set({ isRunning }),

  setCurrentScenarioIndex: (currentScenarioIndex) => set({ currentScenarioIndex }),

  setGeneratingScenarios: (isGeneratingScenarios) => set({ isGeneratingScenarios }),

  setFetchingLogs: (isFetchingLogs) => set({ isFetchingLogs }),
}));
