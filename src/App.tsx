/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Pill,
  Check,
  Plus,
  Search,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Settings,
  Home,
  ClipboardList,
  User,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor
} from 'lucide-react';

export interface Medication {
  id: string;
  name: string;
  dose: string;
  unit: string;
  form: 'Tablet' | 'Capsule' | 'Liquid' | 'Inhaler' | 'Injection' | 'Drops';
  time: string; // HH:mm
  instructions?: string;
  status: 'active' | 'completed' | 'paused';
  startDate: string;
  color?: string;
}

export interface DoseLog {
  id: string;
  medId: string;
  medName: string;
  scheduledTime: string;
  loggedAt: string; // e.g. "07:05 AM"
  date: string; // YYYY-MM-DD
  status: 'taken' | 'skipped';
}

const STORAGE_KEY_MEDS = 'medtracker_medicines_v2';
const STORAGE_KEY_LOGS = 'medtracker_logs_v2';
const STORAGE_KEY_SETTINGS = 'medtracker_settings_v2';

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'm1',
    name: 'Levothyroxine',
    dose: '50',
    unit: 'mcg',
    form: 'Tablet',
    time: '07:00',
    instructions: 'Take in morning with full glass of water, 30m before food',
    status: 'active',
    startDate: '2026-01-15',
    color: '#3b82f6',
  },
  {
    id: 'm2',
    name: 'Vitamin D3',
    dose: '2000',
    unit: 'IU',
    form: 'Capsule',
    time: '12:30',
    instructions: 'Take with a meal containing dietary fat',
    status: 'active',
    startDate: '2026-02-01',
    color: '#eab308',
  },
  {
    id: 'm3',
    name: 'Atorvastatin',
    dose: '20',
    unit: 'mg',
    form: 'Tablet',
    time: '20:00',
    instructions: 'With dinner & full glass of water',
    status: 'active',
    startDate: '2026-03-10',
    color: '#10b981',
  },
  {
    id: 'm4',
    name: 'Amoxicillin',
    dose: '500',
    unit: 'mg',
    form: 'Capsule',
    time: '09:00',
    instructions: 'Completed course for infection',
    status: 'completed',
    startDate: '2026-08-10',
    color: '#8b5cf6',
  },
];

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeString(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'medicines' | 'history' | 'settings'>('home');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [medicines, setMedicines] = useState<Medication[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MEDS);
      return stored ? JSON.parse(stored) : INITIAL_MEDICATIONS;
    } catch {
      return INITIAL_MEDICATIONS;
    }
  });

  const [logs, setLogs] = useState<DoseLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOGS);
      if (stored) return JSON.parse(stored);
      // Default initial logs matching the user's screenshot
      const today = getTodayString();
      return [
        {
          id: 'l1',
          medId: 'm1',
          medName: 'Levothyroxine',
          scheduledTime: '07:00',
          loggedAt: '07:05 AM',
          date: today,
          status: 'taken',
        },
        {
          id: 'l2',
          medId: 'm2',
          medName: 'Vitamin D3',
          scheduledTime: '12:30',
          loggedAt: '12:35 PM',
          date: today,
          status: 'taken',
        },
      ];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [medFilter, setMedFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<'mobile' | 'expanded'>('mobile');

  // Form states
  const [formName, setFormName] = useState('');
  const [formDose, setFormDose] = useState('');
  const [formUnit, setFormUnit] = useState('mg');
  const [formForm, setFormForm] = useState<Medication['form']>('Tablet');
  const [formTime, setFormTime] = useState('20:00');
  const [formInstructions, setFormInstructions] = useState('');

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MEDS, JSON.stringify(medicines));
    } catch (e) {
      console.error(e);
    }
  }, [medicines]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error(e);
    }
  }, [logs]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  // Date calculation
  const formattedHeaderDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  // Today calculations
  const activeMeds = useMemo(() => {
    return medicines
      .filter((m) => m.status === 'active')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [medicines]);

  const selectedDayLogs = useMemo(() => {
    return logs.filter((l) => l.date === selectedDate);
  }, [logs, selectedDate]);

  const totalScheduled = activeMeds.length;
  const takenCount = useMemo(() => {
    return selectedDayLogs.filter((l) => l.status === 'taken').length;
  }, [selectedDayLogs]);
  const remainingCount = Math.max(0, totalScheduled - takenCount);
  const progressPercent = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 0;

  // Next Dose calculation
  const nextDoseMed = useMemo(() => {
    return activeMeds.find((m) => {
      return !selectedDayLogs.some((l) => l.medId === m.id && l.status === 'taken');
    });
  }, [activeMeds, selectedDayLogs]);

  // Dose logging handlers
  const handleLogDose = (med: Medication) => {
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog: DoseLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medId: med.id,
      medName: med.name,
      scheduledTime: med.time,
      loggedAt: timeFormatted,
      date: selectedDate,
      status: 'taken',
    };

    setLogs((prev) => [...prev, newLog]);
    playChime();
    showToast(`✓ Logged ${med.name} (${med.dose}${med.unit}) as taken`);
  };
const shareDailyReport = () => {
  const dayLogs = logs.filter(
    (log) => log.date === selectedDate
  );

  const taken = dayLogs.filter(
    (log) => log.status === 'taken'
  ).length;

  const report = [
    'MED TRACKER - DAILY REPORT',
    `Date: ${selectedDate}`,
    '',
    `Doses recorded as taken: ${taken}`,
    `Total logged events: ${dayLogs.length}`,
    '',
    'DOSE HISTORY',
    ...dayLogs.map(
      (log) =>
        `${log.status === 'taken' ? 'Taken' : 'Skipped'}: ${log.medName} at ${formatTimeString(log.scheduledTime)}`
    ),
  ].join('\n');

  const url =
    'https://wa.me/?text=' + encodeURIComponent(report);

  window.open(url, '_blank', 'noopener,noreferrer');
};
  const handleUndoDose = (logId: string) => {
    const targetLog = logs.find((l) => l.id === logId);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    showToast(`Undone dose: ${targetLog ? targetLog.medName : 'Medication'}`);
  };

  // Medication CRUD
  const openNewMedModal = () => {
    setEditingMed(null);
    setFormName('');
    setFormDose('');
    setFormUnit('mg');
    setFormForm('Tablet');
    setFormTime('08:00');
    setFormInstructions('');
    setModalOpen(true);
  };

  const openEditMedModal = (med: Medication) => {
    setEditingMed(med);
    setFormName(med.name);
    setFormDose(med.dose);
    setFormUnit(med.unit);
    setFormForm(med.form);
    setFormTime(med.time);
    setFormInstructions(med.instructions || '');
    setModalOpen(true);
  };

  const handleSaveMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDose.trim()) {
      showToast('Please provide medication name and dosage.');
      return;
    }

    if (editingMed) {
      setMedicines((prev) =>
        prev.map((m) =>
          m.id === editingMed.id
            ? {
                ...m,
                name: formName.trim(),
                dose: formDose.trim(),
                unit: formUnit,
                form: formForm,
                time: formTime,
                instructions: formInstructions.trim(),
              }
            : m
        )
      );
      showToast(`Updated ${formName.trim()}`);
    } else {
      const newMed: Medication = {
        id: `med_${Date.now()}`,
        name: formName.trim(),
        dose: formDose.trim(),
        unit: formUnit,
        form: formForm,
        time: formTime,
        instructions: formInstructions.trim(),
        status: 'active',
        startDate: selectedDate,
      };
      setMedicines((prev) => [...prev, newMed]);
      showToast(`Added ${formName.trim()} to daily schedule`);
    }

    setModalOpen(false);
  };

  const handleDeleteMed = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from your medications?`)) {
      setMedicines((prev) => prev.filter((m) => m.id !== id));
      showToast(`Removed ${name}`);
    }
  };

  const handleToggleMedStatus = (med: Medication) => {
    const nextStatus = med.status === 'active' ? 'completed' : 'active';
    setMedicines((prev) =>
      prev.map((m) => (m.id === med.id ? { ...m, status: nextStatus } : m))
    );
    showToast(`Marked ${med.name} as ${nextStatus}`);
  };

  // Backups and Exports
  const handleExportJSON = () => {
    const data = {
      app: 'Med Tracker',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      medicines,
      logs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `med_tracker_backup_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON backup exported successfully');
  };

  const handleExportCSV = () => {
    let csv = 'Log_ID,Medication,Scheduled_Time,Logged_Time,Date,Status\n';
    logs.forEach((l) => {
      csv += `"${l.id}","${l.medName}","${l.scheduledTime}","${l.loggedAt}","${l.date}","${l.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medication_adherence_log_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported adherence logs as CSV');
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.medicines)) {
          setMedicines(parsed.medicines);
        }
        if (Array.isArray(parsed.logs)) {
          setLogs(parsed.logs);
        }
        showToast('Backup restored successfully!');
      } catch (err) {
        showToast('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetToDemo = () => {
    setMedicines(INITIAL_MEDICATIONS);
    const today = getTodayString();
    setLogs([
      {
        id: 'l1',
        medId: 'm1',
        medName: 'Levothyroxine',
        scheduledTime: '07:00',
        loggedAt: '07:05 AM',
        date: today,
        status: 'taken',
      },
      {
        id: 'l2',
        medId: 'm2',
        medName: 'Vitamin D3',
        scheduledTime: '12:30',
        loggedAt: '12:35 PM',
        date: today,
        status: 'taken',
      },
    ]);
    setSelectedDate(today);
    showToast('Sample dataset restored to initial state');
  };

  const handleClearAllData = () => {
    if (window.confirm('Clear all medication schedules and history logs? This cannot be undone.')) {
      setMedicines([]);
      setLogs([]);
      showToast('All local data cleared');
    }
  };

  // Filtered medicines list
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.dose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.instructions && m.instructions.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = medFilter === 'all' || m.status === medFilter;
      return matchesSearch && matchesFilter;
    });
  }, [medicines, searchQuery, medFilter]);

  return (
    <div className="min-h-screen bg-[#f1f3f6] flex flex-col items-center justify-start text-[#191c1e] antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 z-50 px-4 py-2.5 bg-[#143116] text-white text-xs font-semibold rounded-xl shadow-xl flex items-center gap-2 border border-emerald-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Device Bar (for responsive/desktop viewing convenience) */}
      <div className="w-full max-w-[420px] lg:max-w-4xl px-4 pt-3 pb-1 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-[11px] font-semibold text-slate-600">Local Privacy Vault</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute chimes' : 'Enable chimes'}
            className="p-1 rounded-md hover:bg-slate-200/80 transition"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-slate-600" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          <div className="hidden lg:flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[10px]">
            <button
              onClick={() => setViewportMode('mobile')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition ${
                viewportMode === 'mobile' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              Phone View
            </button>
            <button
              onClick={() => setViewportMode('expanded')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition ${
                viewportMode === 'expanded' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Monitor className="w-3 h-3" />
              Dual View
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`w-full ${
          viewportMode === 'expanded' ? 'max-w-4xl' : 'max-w-[420px]'
        } min-h-screen bg-[#f8f9fc] flex flex-col shadow-2xl border-x border-slate-200 relative transition-all duration-300 pb-20`}
      >
        {/* Header Bar */}
        <header className="sticky top-0 z-30 bg-[#f8f9fc]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e4620] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-400 block -mb-0.5">
                Med Tracker
              </span>
              <h1 className="text-base font-bold text-slate-800 capitalize">
                {activeTab === 'home'
                  ? 'Home'
                  : activeTab === 'medicines'
                  ? 'Medicines'
                  : activeTab === 'history'
                  ? 'History'
                  : 'Settings'}
              </h1>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              activeTab === 'settings'
                ? 'bg-[#1e4620] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Profile & Settings"
          >
            <User className="w-4 h-4" />
          </button>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* =================== TAB 1: HOME =================== */}
          {activeTab === 'home' && (
            <div className="space-y-5">
              {/* Headline & Date */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Your medication overview
                </h2>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formattedHeaderDate}</span>
                  </p>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-[11px] font-semibold text-[#1e4620] bg-[#ebf4ee] px-2 py-0.5 rounded-md border border-emerald-200 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Progress Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-xs font-semibold text-slate-700">Today's Progress</span>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {progressPercent >= 100
                        ? 'Completed'
                        : progressPercent > 0
                        ? 'On Track'
                        : 'Starting'}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#1e4620] h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {takenCount} of {totalScheduled} daily doses completed
                  </span>
                  <span>
                    {remainingCount} {remainingCount === 1 ? 'dose' : 'doses'} remaining
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <div className="bg-[#f8f9fc] rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Scheduled
                    </span>
                    <span className="text-base font-bold text-slate-800 tabular-nums">
                      {totalScheduled}
                    </span>
                  </div>
                  <div className="bg-[#ebf4ee] rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[#1e4620]">
                      Taken
                    </span>
                    <span className="text-base font-bold text-[#1e4620] tabular-nums">
                      {takenCount}
                    </span>
                  </div>
                  <div className="bg-[#f8f9fc] rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Remaining
                    </span>
                    <span className="text-base font-bold text-slate-800 tabular-nums">
                      {remainingCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Next Dose Card (Matching Image 1.png) */}
              {nextDoseMed ? (
                <div className="bg-[#ebf4ee] border border-emerald-200/80 rounded-2xl p-4 shadow-xs space-y-3 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1e4620] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Next Dose
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-2">
                        {nextDoseMed.name} {nextDoseMed.dose}
                        {nextDoseMed.unit}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {formatTimeString(nextDoseMed.time)} •{' '}
                        {nextDoseMed.instructions || nextDoseMed.form}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1e4620] shadow-xs">
                      <Pill className="w-5 h-5" />
                    </div>
                  </div>

                  <button
                    onClick={() => handleLogDose(nextDoseMed)}
                    className="w-full bg-[#1e4620] hover:bg-[#143116] active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow transition"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    Mark as Taken
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center space-y-1">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#1e4620] flex items-center justify-center mx-auto mb-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#143116]">All Doses Taken Today!</h3>
                  <p className="text-xs text-slate-600">
                    You have completed all scheduled prescriptions for {formattedHeaderDate}.
                  </p>
                </div>
              )}

              {/* Today's Schedule Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Today's Schedule</h3>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                    {totalScheduled} {totalScheduled === 1 ? 'dose' : 'doses'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeMeds.length === 0 ? (
                    <div className="p-6 bg-white rounded-xl text-center text-slate-400 text-xs border border-slate-200">
                      No active medications scheduled. Tap "Add New Medication" below.
                    </div>
                  ) : (
                    activeMeds.map((med) => {
                      const doseLog = selectedDayLogs.find(
                        (l) => l.medId === med.id && l.status === 'taken'
                      );
                      const isTaken = !!doseLog;

                      return (
                        <div
                          key={med.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                            isTaken
                              ? 'bg-white border-slate-200 opacity-95'
                              : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isTaken
                                  ? 'bg-emerald-100 text-[#1e4620]'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isTaken ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : (
                                <span className="tabular-nums">
                                  {formatTimeString(med.time).split(' ')[0]}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900">{med.name}</span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {med.dose}
                                  {med.unit}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {isTaken
                                  ? `Taken at ${doseLog.loggedAt}`
                                  : `Due at ${formatTimeString(med.time)}`}
                              </div>
                            </div>
                          </div>
                          <div>
                            {isTaken ? (
                              <button
                                onClick={() => handleUndoDose(doseLog.id)}
                                className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 px-2.5 py-1 rounded transition"
                              >
                                Undo
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLogDose(med)}
                                className="bg-[#1e4620] hover:bg-[#143116] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition shadow-xs"
                              >
                                Log
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add New Medication Quick Trigger (Dashed Box) */}
              <button
  type="button"
  onClick={shareDailyReport}
  className="w-full py-3 bg-[#25D366] text-white font-semibold text-sm rounded-xl"
>
  Share Daily Report on WhatsApp
</button>
              <button
                onClick={openNewMedModal}
                className="w-full py-3.5 border-2 border-dashed border-slate-200 hover:border-[#1e4620]/40 hover:bg-emerald-50/40 rounded-xl text-slate-600 font-semibold text-xs flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4 text-slate-500" />
                Add New Medication
              </button>
            </div>
          )}

          {/* =================== TAB 2: MEDICINES =================== */}
          {activeTab === 'medicines' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">My Medicines</h2>
                  <p className="text-xs text-slate-500">Manage all registered prescriptions</p>
                </div>
                <button
                  onClick={openNewMedModal}
                  className="bg-[#1e4620] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:bg-[#143116] transition"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medications, dosages, notes..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/20"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1.5 text-xs">
                {(['all', 'active', 'completed'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setMedFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-full font-semibold capitalize transition ${
                      medFilter === filterKey
                        ? 'bg-[#1e4620] text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>

              {/* Medicine Cards List */}
              <div className="space-y-3">
                {filteredMedicines.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
                    <p className="text-xs font-bold text-slate-700">No medicines found</p>
                    <p className="text-[11px] text-slate-400">
                      Try another search keyword or tap Add to create a new prescription.
                    </p>
                  </div>
                ) : (
                  filteredMedicines.map((med) => (
                    <div
                      key={med.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{med.name}</h4>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({med.dose}
                              {med.unit} • {med.form})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Started {med.startDate}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            med.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {med.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-[#f8f9fc] p-3 rounded-xl space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            <strong>Daily Schedule:</strong> {formatTimeString(med.time)}
                          </span>
                        </p>
                        {med.instructions && (
                          <p className="flex items-start gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Instructions:</strong> {med.instructions}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <button
                          onClick={() => handleToggleMedStatus(med)}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
                        >
                          {med.status === 'active' ? 'Mark Completed' : 'Reactivate'}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditMedModal(med)}
                            className="text-xs font-semibold text-[#1e4620] hover:underline flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMed(med.id, med.name)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-700 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =================== TAB 3: HISTORY =================== */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Medication History
                  </h2>
                  <p className="text-xs text-slate-500">Audit logs & adherence records</p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="text-xs font-semibold text-[#1e4620] bg-[#ebf4ee] px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>

              {/* Adherence Summary Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Adherence Summary</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Client-Side Log
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-[#f8f9fc] rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Total Doses Logged
                    </span>
                    <span className="text-xl font-bold text-slate-800 tabular-nums">
                      {logs.length}
                    </span>
                  </div>
                  <div className="p-3 bg-[#ebf4ee] rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#1e4620] block">
                      Compliance Rate
                    </span>
                    <span className="text-xl font-bold text-[#1e4620] tabular-nums">
                      {logs.length > 0 ? '100%' : 'N/A'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  *Records logged locally on device. Adherence statistics do not guarantee clinical
                  outcomes.
                </p>
              </div>

              {/* Timeline List */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Recent Dose Activity ({logs.length})
                </h3>
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <div className="p-6 bg-white rounded-xl text-center text-slate-400 text-xs border border-slate-200">
                      No logged dose events recorded yet. Mark medications as taken on the Home
                      screen to generate activity.
                    </div>
                  ) : (
                    [...logs].reverse().map((log) => (
                      <div
                        key={log.id}
                        className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#1e4620] flex items-center justify-center font-bold text-[10px]">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                          <div>
                            <p className="font-bold text-slate-800">{log.medName}</p>
                            <p className="text-[10px] text-slate-400">
                              {log.date} • Sched: {formatTimeString(log.scheduledTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded">
                            Logged {log.loggedAt}
                          </span>
                          <button
                            onClick={() => handleUndoDose(log.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Remove log entry"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================== TAB 4: SETTINGS =================== */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
                <p className="text-xs text-slate-500">Preferences and client-side data vault</p>
              </div>

              {/* Privacy Vault Notice */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 bg-[#1e4620] text-white text-[10px] font-bold rounded-md uppercase">
                    Private
                  </span>
                  <h3 className="text-xs font-bold text-emerald-950">Client-Side Data Vault</h3>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Zero external server transmission. All medical schedules, adherence stats, and log
                  history exist solely inside your device browser storage (LocalStorage).
                </p>
              </div>

              {/* Preferences */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Display & Alerts
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Audio Confirmation Chime
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Plays gentle tone when dose is logged
                    </span>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      soundEnabled ? 'bg-[#1e4620]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        soundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Single User Architecture
                    </span>
                    <span className="text-[10px] text-slate-400">
                      No account registration or password required
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              </div>

              {/* Data Management */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Data Management
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="bg-[#1e4620] hover:bg-[#143116] text-white py-2.5 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Backup JSON
                  </button>
                  <label className="bg-slate-100 text-slate-700 py-2.5 px-3 rounded-xl text-xs font-semibold hover:bg-slate-200 transition text-center cursor-pointer flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Restore JSON
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleRestoreJSON}
                      accept=".json"
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  onClick={handleResetToDemo}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reload Sample Data
                </button>

                <button
                  onClick={handleClearAllData}
                  className="w-full py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset All Application Data
                </button>
              </div>

              {/* App Info Footer */}
              <div className="text-center pt-2 text-[11px] text-slate-400 space-y-1">
                <p>Med Tracker v1.0.0 (Clinical Clarity)</p>
                <p>Private Client-Side Progressive Application</p>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Tab Navigation */}
        <nav className="fixed bottom-0 z-40 w-full max-w-[420px] lg:max-w-4xl bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-2 pb-4 flex justify-around items-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'home' ? 'text-[#1e4620]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Home className="w-5 h-5" />
            <span
              className={`text-[10px] ${activeTab === 'home' ? 'font-bold' : 'font-medium'}`}
            >
              Home
            </span>
          </button>

          <button
            onClick={() => setActiveTab('medicines')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'medicines' ? 'text-[#1e4620]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Pill className="w-5 h-5" />
            <span
              className={`text-[10px] ${activeTab === 'medicines' ? 'font-bold' : 'font-medium'}`}
            >
              Medicines
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'history' ? 'text-[#1e4620]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span
              className={`text-[10px] ${activeTab === 'history' ? 'font-bold' : 'font-medium'}`}
            >
              History
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'settings' ? 'text-[#1e4620]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span
              className={`text-[10px] ${activeTab === 'settings' ? 'font-bold' : 'font-medium'}`}
            >
              Settings
            </span>
          </button>
        </nav>
      </div>

      {/* =================== ADD / EDIT MEDICATION MODAL =================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[420px] bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <h3 className="text-sm font-bold text-slate-800">
                {editingMed ? 'Edit Medication' : 'New Medication'}
              </h3>
              <button
                type="button"
                onClick={handleSaveMed}
                className="text-xs font-bold text-[#1e4620] hover:text-[#143116]"
              >
                Save
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Atorvastatin"
                  className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dosage Amount *</label>
                  <input
                    type="text"
                    required
                    value={formDose}
                    onChange={(e) => setFormDose(e.target.value)}
                    placeholder="e.g., 20"
                    className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                  >
                    <option value="mg">mg (Milligrams)</option>
                    <option value="mcg">mcg (Micrograms)</option>
                    <option value="ml">ml (Milliliters)</option>
                    <option value="IU">IU (Units)</option>
                    <option value="tablets">tablets</option>
                    <option value="drops">drops</option>
                    <option value="puffs">puffs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medication Form</label>
                <select
                  value={formForm}
                  onChange={(e) => setFormForm(e.target.value as Medication['form'])}
                  className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Liquid">Liquid</option>
                  <option value="Inhaler">Inhaler</option>
                  <option value="Injection">Injection</option>
                  <option value="Drops">Drops</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Scheduled Time (Daily) *
                </label>
                <input
                  type="time"
                  required
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Instructions / Notes
                </label>
                <input
                  type="text"
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="e.g., With dinner & full glass of water"
                  className="w-full bg-[#f8f9fc] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e4620]/30"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1e4620] hover:bg-[#143116] text-white font-semibold py-3 rounded-xl text-xs shadow transition"
                >
                  {editingMed ? 'Save Changes' : 'Save Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
