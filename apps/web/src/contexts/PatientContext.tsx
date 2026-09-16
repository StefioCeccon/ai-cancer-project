"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const STORAGE_KEY = "ai-cancer-project:selected-patient-id";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface PatientContextValue {
  patients: Patient[];
  selectedPatientId: string;
  selectedPatient: Patient | undefined;
  setSelectedPatientId: (id: string) => void;
  loading: boolean;
  refreshPatients: () => Promise<void>;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedPatientIdState(stored);
  }, []);

  const refreshPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/patients");
      const data = await res.json();
      const list: Patient[] = data.data ?? [];
      setPatients(list);

      setSelectedPatientIdState((current) => {
        if (current && !list.some((p) => p.id === current)) {
          localStorage.removeItem(STORAGE_KEY);
          return "";
        }
        return current;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPatients();
  }, [refreshPatients]);

  const setSelectedPatientId = useCallback((id: string) => {
    setSelectedPatientIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <PatientContext.Provider
      value={{
        patients,
        selectedPatientId,
        selectedPatient,
        setSelectedPatientId,
        loading,
        refreshPatients,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error("usePatient must be used within PatientProvider");
  }
  return ctx;
}
