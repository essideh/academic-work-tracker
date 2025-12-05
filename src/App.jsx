import { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const DEFAULT_CATEGORIES = {
  Research: ['Writing', 'Reading', 'Grant writing', 'Fieldwork', 'Supervision', 'Meetings', 'Admin', 'Misc'],
  Teaching: ['Delivery', 'Preparation', 'Unit design', 'Marking', 'Admin', 'Meetings', 'Misc'],
  Service: ['Meetings', 'Peer review', 'Admin', 'Training', 'Public engagement', 'Mentoring', 'Misc'],
  Other: ['Annual Leave', 'Personal Leave', 'Public Holiday']
};

const DEFAULT_ALLOCATION = {
  Research: 40,
  Teaching: 40,
  Service: 20
};

const CATEGORY_COLORS = {
  Research: { primary: '#3b82f6', light: '#dbeafe', dark: '#1e40af' },
  Teaching: { primary: '#10b981', light: '#d1fae5', dark: '#065f46' },
  Service: { primary: '#f59e0b', light: '#fef3c7', dark: '#92400e' },
  Other: { primary: '#8b5cf6', light: '#ede9fe', dark: '#5b21b6' }
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function AcademicWorkTracker() {
  const [activeTab, setActiveTab] = useState('today');
  const [entries, setEntries] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState({
    hoursPerWeek: 37.5,
    carryoverHours: 0,
    startOfYear: '2025-01-06',
    allocation: DEFAULT_ALLOCATION,
    missingDataWarning: {
      enabled: true,
      days: 5,
      includeWeekends: false
    }
  });
  const [dismissedWarning, setDismissedWarning] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('academicTrackerV2') || '{}');
    if (saved.entries) setEntries(saved.entries);
    if (saved.categories) setCategories(saved.categories);
    if (saved.settings) setSettings(s => ({ ...s, ...saved.settings }));
    if (saved.googleSheetsUrl) setGoogleSheetsUrl(saved.googleSheetsUrl);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('academicTrackerV2', JSON.stringify({ 
      entries, 
      categories, 
      settings,
      googleSheetsUrl 
    }));
  }, [entries, categories, settings, googleSheetsUrl]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getWeekDates = (baseDate) => {
    const d = new Date(baseDate);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  };

  const getDayTotal = useCallback((date) => {
    if (!entries[date]) return 0;
    return Object.values(entries[date]).reduce((sum, catData) => 
      sum + Object.values(catData).reduce((s, v) => s + (v || 0), 0), 0);
  }, [entries]);

  const getCategoryTotal = useCallback((date, category) => {
    if (!entries[date]?.[category]) return 0;
    return Object.values(entries[date][category]).reduce((s, v) => s + (v || 0), 0);
  }, [entries]);

  // Check for missing data in the past N days
  const getMissingDays = useCallback(() => {
    if (!settings.missingDataWarning.enabled) return [];
    
    const { days, includeWeekends } = settings.missingDataWarning;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const missingDays = [];
    let daysChecked = 0;
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() - 1); // Start from yesterday
    
    while (daysChecked < days) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Skip weekends if not included
      if (!includeWeekends && isWeekend) {
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayTotal = getDayTotal(dateStr);
      
      if (dayTotal === 0) {
        missingDays.push({
          date: dateStr,
          formatted: currentDate.toLocaleDateString('en-AU', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          }),
          isWeekend
        });
      }
      
      daysChecked++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return missingDays;
  }, [entries, settings.missingDataWarning, getDayTotal]);

  const missingDays = useMemo(() => getMissingDays(), [getMissingDays]);

  const updateEntry = (date, category, task, value) => {
    const numValue = parseFloat(value) || 0;
    setEntries(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [category]: {
          ...prev[date]?.[category],
          [task]: numValue
        }
      }
    }));
  };

  const getEntryValue = (date, category, task) => {
    return entries[date]?.[category]?.[task] || '';
  };

  const addTask = (category) => {
    if (!newTaskName.trim()) return;
    if (categories[category].includes(newTaskName.trim())) {
      alert('This task already exists in this category');
      return;
    }
    setCategories(prev => ({
      ...prev,
      [category]: [...prev[category], newTaskName.trim()]
    }));
    setNewTaskName('');
    setEditingTask(null);
  };

  const removeTask = (category, task) => {
    if (!confirm(`Remove "${task}" from ${category}? This won't delete any recorded hours.`)) return;
    setCategories(prev => ({
      ...prev,
      [category]: prev[category].filter(t => t !== task)
    }));
  };

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const allDates = Object.keys(entries).sort();
    if (allDates.length === 0) {
      alert('No data to export');
      return;
    }

    // Build header
    let csv = 'Date,Day,Category,Task,Hours\n';
    
    // Build rows
    allDates.forEach(date => {
      const dayName = new Date(date).toLocaleDateString('en-AU', { weekday: 'short' });
      Object.entries(entries[date] || {}).forEach(([category, tasks]) => {
        Object.entries(tasks).forEach(([task, hours]) => {
          if (hours > 0) {
            csv += `${date},${dayName},${category},"${task}",${hours}\n`;
          }
        });
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export summary CSV (weekly aggregates)
  const exportSummaryCSV = () => {
    const allDates = Object.keys(entries).sort();
    if (allDates.length === 0) {
      alert('No data to export');
      return;
    }

    // Group by week
    const weeklyData = {};
    allDates.forEach(date => {
      const weekStart = getWeekDates(date)[0];
      if (!weeklyData[weekStart]) {
        weeklyData[weekStart] = { Research: 0, Teaching: 0, Service: 0, Other: 0 };
      }
      Object.keys(weeklyData[weekStart]).forEach(cat => {
        weeklyData[weekStart][cat] += getCategoryTotal(date, cat);
      });
    });

    let csv = 'Week Starting,Research Hours,Teaching Hours,Service Hours,Other Hours,Total Hours\n';
    Object.entries(weeklyData).sort((a, b) => a[0].localeCompare(b[0])).forEach(([week, data]) => {
      const total = data.Research + data.Teaching + data.Service + data.Other;
      csv += `${week},${data.Research.toFixed(2)},${data.Teaching.toFixed(2)},${data.Service.toFixed(2)},${data.Other.toFixed(2)},${total.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-tracker-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Google Sheets sync (using Apps Script Web App)
  const syncToGoogleSheets = async () => {
    if (!googleSheetsUrl) {
      alert('Please enter your Google Sheets Web App URL in settings first.\n\nSee the help section for setup instructions.');
      return;
    }

    setSyncStatus('syncing');
    
    try {
      const allDates = Object.keys(entries).sort();
      const data = [];
      
      allDates.forEach(date => {
        Object.entries(entries[date] || {}).forEach(([category, tasks]) => {
          Object.entries(tasks).forEach(([task, hours]) => {
            if (hours > 0) {
              data.push({ date, category, task, hours });
            }
          });
        });
      });

      const response = await fetch(googleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sync',
          data,
          settings: {
            hoursPerWeek: settings.hoursPerWeek,
            allocation: settings.allocation
          }
        })
      });

      setSyncStatus('success');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  // Statistics calculations
  const stats = useMemo(() => {
    const allDates = Object.keys(entries).filter(d => getDayTotal(d) > 0).sort();
    if (allDates.length === 0) return null;

    const totalHours = allDates.reduce((sum, d) => sum + getDayTotal(d), 0);
    const categoryTotals = { Research: 0, Teaching: 0, Service: 0, Other: 0 };
    
    allDates.forEach(date => {
      Object.keys(categoryTotals).forEach(cat => {
        categoryTotals[cat] += getCategoryTotal(date, cat);
      });
    });

    const workingHoursTotal = categoryTotals.Research + categoryTotals.Teaching + categoryTotals.Service;
    
    // Calculate actual vs allocated percentages
    const actualPercentages = {
      Research: workingHoursTotal > 0 ? (categoryTotals.Research / workingHoursTotal) * 100 : 0,
      Teaching: workingHoursTotal > 0 ? (categoryTotals.Teaching / workingHoursTotal) * 100 : 0,
      Service: workingHoursTotal > 0 ? (categoryTotals.Service / workingHoursTotal) * 100 : 0
    };

    const allocationDiff = {
      Research: actualPercentages.Research - settings.allocation.Research,
      Teaching: actualPercentages.Teaching - settings.allocation.Teaching,
      Service: actualPercentages.Service - settings.allocation.Service
    };

    // Weekly data
    const weeklyData = {};
    allDates.forEach(date => {
      const weekStart = getWeekDates(date)[0];
      if (!weeklyData[weekStart]) {
        weeklyData[weekStart] = { Research: 0, Teaching: 0, Service: 0, Other: 0, total: 0 };
      }
      Object.keys(categoryTotals).forEach(cat => {
        weeklyData[weekStart][cat] += getCategoryTotal(date, cat);
      });
      weeklyData[weekStart].total += getDayTotal(date);
    });

    const weeksWorked = Object.keys(weeklyData).length;
    const avgWeek = weeksWorked > 0 ? totalHours / weeksWorked : 0;
    const avgDay = allDates.length > 0 ? totalHours / allDates.length : 0;
    
    const expectedHours = weeksWorked * settings.hoursPerWeek;
    const overUnder = totalHours - expectedHours + settings.carryoverHours;

    // Day of week breakdown
    const dayOfWeekTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayOfWeekCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    allDates.forEach(date => {
      const dayName = dayNames[new Date(date).getDay()];
      const hours = getDayTotal(date);
      if (hours > 0) {
        dayOfWeekTotals[dayName] += hours;
        dayOfWeekCounts[dayName]++;
      }
    });

    const dayOfWeekAvg = Object.keys(dayOfWeekTotals).map(day => ({
      day,
      hours: dayOfWeekCounts[day] > 0 ? dayOfWeekTotals[day] / dayOfWeekCounts[day] : 0
    }));

    // Radar chart data for allocation comparison
    const radarData = [
      { category: 'Research', actual: actualPercentages.Research, allocated: settings.allocation.Research },
      { category: 'Teaching', actual: actualPercentages.Teaching, allocated: settings.allocation.Teaching },
      { category: 'Service', actual: actualPercentages.Service, allocated: settings.allocation.Service }
    ];

    return {
      totalHours,
      workingHoursTotal,
      categoryTotals,
      actualPercentages,
      allocationDiff,
      weeksWorked,
      daysWorked: allDates.length,
      avgWeek,
      avgDay,
      overUnder,
      weeklyData: Object.entries(weeklyData).map(([week, data]) => ({ week, ...data })).sort((a, b) => a.week.localeCompare(b.week)),
      dayOfWeekAvg,
      radarData,
      categoryPercentages: Object.entries(categoryTotals)
        .filter(([cat]) => cat !== 'Other')
        .map(([name, value]) => ({
          name,
          value,
          percentage: workingHoursTotal > 0 ? ((value / workingHoursTotal) * 100).toFixed(1) : 0
        }))
    };
  }, [entries, settings, getDayTotal, getCategoryTotal]);

  const weekDates = getWeekDates(selectedDate);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#e2e8f0'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        * { box-sizing: border-box; }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        .glass-card {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
        }
        
        .hover-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        }
        
        .tab-button {
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        
        .tab-active {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }
        
        .tab-inactive {
          background: rgba(51, 65, 85, 0.5);
          color: #94a3b8;
        }
        .tab-inactive:hover {
          background: rgba(71, 85, 105, 0.6);
          color: #e2e8f0;
        }
        
        .input-hours {
          width: 70px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          text-align: center;
          transition: all 0.2s ease;
        }
        .input-hours:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        .stat-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
          padding: 20px;
        }
        
        .category-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .diff-positive { color: #f87171; }
        .diff-negative { color: #34d399; }
        .diff-neutral { color: #94a3b8; }
        
        .allocation-bar {
          height: 8px;
          border-radius: 4px;
          background: rgba(100, 116, 139, 0.3);
          overflow: hidden;
          position: relative;
        }
        
        .allocation-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .allocation-bar-marker {
          position: absolute;
          top: -4px;
          width: 2px;
          height: 16px;
          background: white;
          border-radius: 1px;
        }
      `}</style>

      {/* Header */}
      <header style={{
        padding: '24px 32px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            margin: 0,
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Academic Work Tracker
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Track your actual work hours • Compare against your workload allocation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="tab-button tab-inactive"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card" style={{ margin: '24px 32px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600 }}>Settings & Data</h3>
          
          {/* Work Hours Settings */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Work Hours
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px' }}>
                  Paid hours per week
                </label>
                <input
                  type="number"
                  value={settings.hoursPerWeek}
                  onChange={e => setSettings(s => ({ ...s, hoursPerWeek: parseFloat(e.target.value) || 0 }))}
                  className="input-hours"
                  style={{ width: '100px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px' }}>
                  Hours carried from previous year
                </label>
                <input
                  type="number"
                  value={settings.carryoverHours}
                  onChange={e => setSettings(s => ({ ...s, carryoverHours: parseFloat(e.target.value) || 0 }))}
                  className="input-hours"
                  style={{ width: '100px' }}
                />
              </div>
            </div>
          </div>

          {/* Workload Allocation */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Workload Allocation (%)
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Enter your official workload distribution. This will be compared against your actual hours.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              {['Research', 'Teaching', 'Service'].map(cat => (
                <div key={cat} style={{ 
                  padding: '16px',
                  borderRadius: '12px',
                  background: `${CATEGORY_COLORS[cat].primary}15`,
                  border: `1px solid ${CATEGORY_COLORS[cat].primary}30`
                }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: CATEGORY_COLORS[cat].primary, fontSize: '14px', fontWeight: 500 }}>
                    {cat}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.allocation[cat]}
                      onChange={e => setSettings(s => ({ 
                        ...s, 
                        allocation: { ...s.allocation, [cat]: parseFloat(e.target.value) || 0 }
                      }))}
                      className="input-hours"
                      style={{ width: '70px' }}
                    />
                    <span style={{ color: '#64748b' }}>%</span>
                  </div>
                </div>
              ))}
            </div>
            {(settings.allocation.Research + settings.allocation.Teaching + settings.allocation.Service) !== 100 && (
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#f59e0b' }}>
                ⚠️ Allocations should total 100% (currently {settings.allocation.Research + settings.allocation.Teaching + settings.allocation.Service}%)
              </p>
            )}
          </div>

          {/* Missing Data Warning Settings */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Missing Data Reminder
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Get reminded when you haven't logged hours for recent days.
            </p>
            
            <div style={{ 
              padding: '20px',
              borderRadius: '12px',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)'
            }}>
              {/* Enable/Disable Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#e2e8f0'
                }}>
                  <input
                    type="checkbox"
                    checked={settings.missingDataWarning.enabled}
                    onChange={e => setSettings(s => ({ 
                      ...s, 
                      missingDataWarning: { ...s.missingDataWarning, enabled: e.target.checked }
                    }))}
                    style={{ 
                      width: '18px', 
                      height: '18px',
                      accentColor: '#fbbf24',
                      cursor: 'pointer'
                    }}
                  />
                  Enable missing data warnings
                </label>
              </div>
              
              {settings.missingDataWarning.enabled && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
                  {/* Days to check */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px' }}>
                      Check past
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.missingDataWarning.days}
                        onChange={e => setSettings(s => ({ 
                          ...s, 
                          missingDataWarning: { ...s.missingDataWarning, days: parseInt(e.target.value) || 5 }
                        }))}
                        className="input-hours"
                        style={{ width: '70px' }}
                      />
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>days</span>
                    </div>
                  </div>
                  
                  {/* Include weekends */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '14px' }}>
                      Day types to check
                    </label>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#e2e8f0',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(148, 163, 184, 0.2)'
                    }}>
                      <input
                        type="checkbox"
                        checked={settings.missingDataWarning.includeWeekends}
                        onChange={e => setSettings(s => ({ 
                          ...s, 
                          missingDataWarning: { ...s.missingDataWarning, includeWeekends: e.target.checked }
                        }))}
                        style={{ 
                          width: '16px', 
                          height: '16px',
                          accentColor: '#fbbf24',
                          cursor: 'pointer'
                        }}
                      />
                      Include weekends
                    </label>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                      {settings.missingDataWarning.includeWeekends 
                        ? 'Checking all days including Sat/Sun' 
                        : 'Only checking weekdays (Mon-Fri)'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export Options */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Export Data
            </h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={exportToCSV} className="tab-button tab-inactive">
                📊 Export Detailed CSV
              </button>
              <button onClick={exportSummaryCSV} className="tab-button tab-inactive">
                📈 Export Weekly Summary
              </button>
              <button 
                onClick={() => {
                  const data = JSON.stringify({ entries, categories, settings }, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `work-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                }}
                className="tab-button tab-inactive"
              >
                💾 Export Full Backup (JSON)
              </button>
            </div>
          </div>

          {/* Google Sheets Sync */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Google Sheets Sync (Optional)
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
              Connect to your own Google Sheet to backup your data automatically.
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Enter your Google Apps Script Web App URL..."
                value={googleSheetsUrl}
                onChange={e => setGoogleSheetsUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
              <button 
                onClick={syncToGoogleSheets}
                className="tab-button"
                style={{
                  background: syncStatus === 'success' ? '#10b981' : 
                             syncStatus === 'error' ? '#ef4444' : 
                             syncStatus === 'syncing' ? '#6366f1' : 
                             'rgba(51, 65, 85, 0.5)',
                  color: 'white'
                }}
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? '⏳ Syncing...' :
                 syncStatus === 'success' ? '✓ Synced!' :
                 syncStatus === 'error' ? '✗ Error' :
                 '🔄 Sync Now'}
              </button>
            </div>
            <details style={{ fontSize: '13px', color: '#64748b' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>📖 How to set up Google Sheets sync</summary>
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: '8px' }}>
                <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li>Create a new Google Sheet</li>
                  <li>Go to Extensions → Apps Script</li>
                  <li>Paste the sync script (we can provide this)</li>
                  <li>Deploy as Web App (execute as yourself, anyone can access)</li>
                  <li>Copy the Web App URL and paste it above</li>
                </ol>
              </div>
            </details>
          </div>

          {/* Import */}
          <div>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Import Data
            </h4>
            <input
              type="file"
              accept=".json"
              onChange={e => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result);
                      if (data.entries) setEntries(data.entries);
                      if (data.categories) setCategories(data.categories);
                      if (data.settings) setSettings(s => ({ ...s, ...data.settings }));
                      alert('Data imported successfully!');
                    } catch {
                      alert('Invalid file format');
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              style={{ color: '#94a3b8', fontSize: '14px' }}
            />
          </div>
        </div>
      )}

      {/* Missing Data Warning Banner */}
      {missingDays.length > 0 && dismissedWarning !== new Date().toISOString().split('T')[0] && (
        <div style={{ 
          margin: '24px 32px', 
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px'
        }}>
          <div style={{ 
            fontSize: '28px',
            lineHeight: 1,
            flexShrink: 0
          }}>
            ⚠️
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              margin: '0 0 8px', 
              fontSize: '16px', 
              fontWeight: 600,
              color: '#fbbf24'
            }}>
              Missing Data for {missingDays.length} {missingDays.length === 1 ? 'Day' : 'Days'}
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#cbd5e1' }}>
              You haven't logged any hours for the following {settings.missingDataWarning.includeWeekends ? 'days' : 'working days'}:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {missingDays.map(day => (
                <button
                  key={day.date}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setActiveTab('today');
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(251, 191, 36, 0.4)',
                    background: day.isWeekend ? 'rgba(139, 92, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(251, 191, 36, 0.3)'}
                  onMouseOut={e => e.currentTarget.style.background = day.isWeekend ? 'rgba(139, 92, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)'}
                >
                  {day.formatted}
                  {day.isWeekend && <span style={{ fontSize: '10px', opacity: 0.7 }}>(weekend)</span>}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              💡 Click any date above to quickly add hours for that day
            </p>
          </div>
          <button
            onClick={() => setDismissedWarning(new Date().toISOString().split('T')[0])}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              flexShrink: 0
            }}
            title="Dismiss for today"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={{ padding: '24px 32px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { id: 'today', label: '📅 Today' },
          { id: 'week', label: '📊 Week View' },
          { id: 'stats', label: '📈 Statistics' },
          { id: 'allocation', label: '⚖️ Allocation' },
          { id: 'tasks', label: '✏️ Manage Tasks' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '0 32px 48px' }}>
        
        {/* TODAY VIEW */}
        {activeTab === 'today' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="tab-button tab-inactive"
              >
                ←
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="tab-button tab-inactive"
              >
                →
              </button>
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="tab-button tab-inactive"
              >
                Today
              </button>
              <div style={{ marginLeft: 'auto', fontSize: '24px', fontWeight: 600 }}>
                <span style={{ color: '#64748b', fontSize: '14px', marginRight: '8px' }}>Total:</span>
                <span style={{ 
                  fontFamily: 'JetBrains Mono',
                  color: getDayTotal(selectedDate) > 0 ? '#60a5fa' : '#475569'
                }}>
                  {getDayTotal(selectedDate).toFixed(1)}h
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {Object.entries(categories).map(([category, tasks]) => (
                <div key={category} className="glass-card hover-lift" style={{ overflow: 'hidden' }}>
                  <div 
                    className="category-header"
                    style={{ background: `linear-gradient(135deg, ${CATEGORY_COLORS[category].primary}20, ${CATEGORY_COLORS[category].dark}30)` }}
                    onClick={() => toggleCategory(category)}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[category].primary
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '16px', flex: 1 }}>{category}</span>
                    <span style={{ 
                      fontFamily: 'JetBrains Mono',
                      fontSize: '14px',
                      color: CATEGORY_COLORS[category].primary
                    }}>
                      {getCategoryTotal(selectedDate, category).toFixed(1)}h
                    </span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {collapsedCategories[category] ? '▼' : '▲'}
                    </span>
                  </div>
                  {!collapsedCategories[category] && (
                    <div style={{ padding: '0 20px 20px' }}>
                      {tasks.map(task => (
                        <div key={task} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                          <span style={{ color: '#cbd5e1', fontSize: '14px' }}>{task}</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            placeholder="0"
                            value={getEntryValue(selectedDate, category, task)}
                            onChange={e => updateEntry(selectedDate, category, task, e.target.value)}
                            className="input-hours"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {activeTab === 'week' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 7);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="tab-button tab-inactive"
              >
                ← Previous Week
              </button>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>
                {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
              </span>
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 7);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="tab-button tab-inactive"
              >
                Next Week →
              </button>
              <div style={{ marginLeft: 'auto', fontSize: '24px', fontWeight: 600 }}>
                <span style={{ color: '#64748b', fontSize: '14px', marginRight: '8px' }}>Week Total:</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#60a5fa' }}>
                  {weekDates.reduce((sum, d) => sum + getDayTotal(d), 0).toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="glass-card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', width: '160px', position: 'sticky', left: 0, background: 'rgba(30, 41, 59, 0.95)' }}>
                      Category / Task
                    </th>
                    {weekDates.map((date, i) => (
                      <th key={date} style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        background: date === new Date().toISOString().split('T')[0] ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          {new Date(date).getDate()}
                        </div>
                      </th>
                    ))}
                    <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', width: '80px' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categories).map(([category, tasks]) => (
                    <React.Fragment key={category}>
                      <tr style={{ background: `${CATEGORY_COLORS[category].primary}15` }}>
                        <td 
                          colSpan={9} 
                          style={{ 
                            padding: '12px 16px', 
                            fontWeight: 600,
                            color: CATEGORY_COLORS[category].primary,
                            cursor: 'pointer',
                            position: 'sticky',
                            left: 0,
                            background: `${CATEGORY_COLORS[category].primary}15`
                          }}
                          onClick={() => toggleCategory(category)}
                        >
                          {collapsedCategories[category] ? '▶' : '▼'} {category}
                        </td>
                      </tr>
                      {!collapsedCategories[category] && tasks.map(task => (
                        <tr key={`${category}-${task}`}>
                          <td style={{ padding: '8px 16px 8px 32px', color: '#94a3b8', fontSize: '14px', position: 'sticky', left: 0, background: 'rgba(30, 41, 59, 0.95)' }}>
                            {task}
                          </td>
                          {weekDates.map(date => (
                            <td key={date} style={{ 
                              padding: '4px 8px', 
                              textAlign: 'center',
                              background: date === new Date().toISOString().split('T')[0] ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                            }}>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                placeholder="—"
                                value={getEntryValue(date, category, task)}
                                onChange={e => updateEntry(date, category, task, e.target.value)}
                                className="input-hours"
                                style={{ width: '55px' }}
                              />
                            </td>
                          ))}
                          <td style={{ 
                            padding: '8px', 
                            textAlign: 'center',
                            fontFamily: 'JetBrains Mono',
                            fontSize: '13px',
                            color: '#64748b'
                          }}>
                            {weekDates.reduce((sum, d) => sum + (parseFloat(getEntryValue(d, category, task)) || 0), 0).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                    <td style={{ padding: '16px', fontWeight: 600, position: 'sticky', left: 0, background: 'rgba(59, 130, 246, 0.1)' }}>Daily Total</td>
                    {weekDates.map(date => (
                      <td key={date} style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 600,
                        color: getDayTotal(date) > 8 ? '#f59e0b' : getDayTotal(date) > 0 ? '#60a5fa' : '#475569'
                      }}>
                        {getDayTotal(date).toFixed(1)}
                      </td>
                    ))}
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'center', 
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 700,
                      color: '#60a5fa'
                    }}>
                      {weekDates.reduce((sum, d) => sum + getDayTotal(d), 0).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATISTICS VIEW */}
        {activeTab === 'stats' && (
          <div>
            {!stats ? (
              <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>No data yet</h3>
                <p style={{ color: '#64748b', margin: 0 }}>Start tracking your hours to see statistics here.</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  {[
                    { label: 'Total Hours', value: `${stats.totalHours.toFixed(1)}h`, color: '#60a5fa' },
                    { label: 'Average Week', value: `${stats.avgWeek.toFixed(1)}h`, color: '#a78bfa' },
                    { label: 'Average Day', value: `${stats.avgDay.toFixed(1)}h`, color: '#34d399' },
                    { label: 'Days Tracked', value: stats.daysWorked, color: '#fbbf24' },
                    { label: 'Weeks Tracked', value: stats.weeksWorked, color: '#f472b6' },
                    { 
                      label: 'Hours Over/Under', 
                      value: `${stats.overUnder >= 0 ? '+' : ''}${stats.overUnder.toFixed(1)}h`, 
                      color: stats.overUnder >= 0 ? '#34d399' : '#f87171',
                      subtitle: stats.overUnder >= 0 ? 'Overworked' : 'Underworked'
                    }
                  ].map((stat, i) => (
                    <div key={i} className="stat-card hover-lift">
                      <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>{stat.label}</div>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: stat.color, fontFamily: 'JetBrains Mono' }}>
                        {stat.value}
                      </div>
                      {stat.subtitle && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{stat.subtitle}</div>}
                    </div>
                  ))}
                </div>

                {/* Charts Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                  
                  {/* Workload Distribution Pie */}
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                      Workload Distribution (excl. Leave)
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={stats.categoryPercentages}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {stats.categoryPercentages.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        {stats.categoryPercentages.map((cat, i) => (
                          <div key={cat.name} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            marginBottom: '12px'
                          }}>
                            <div style={{ 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '3px',
                              background: PIE_COLORS[i],
                              flexShrink: 0
                            }} />
                            <span style={{ flex: 1, fontSize: '14px' }}>{cat.name}</span>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: '#94a3b8' }}>
                              {cat.percentage}%
                            </span>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, minWidth: '50px', textAlign: 'right' }}>
                              {cat.value.toFixed(1)}h
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Day of Week Average */}
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                      Average Hours by Day of Week
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={stats.dayOfWeekAvg} layout="vertical">
                        <XAxis type="number" stroke="#475569" fontSize={12} />
                        <YAxis dataKey="day" type="category" stroke="#475569" fontSize={12} width={40} />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#e2e8f0' }}
                          formatter={(value) => [`${value.toFixed(1)}h`, 'Average']}
                        />
                        <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Weekly Hours Trend */}
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                    Weekly Hours Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={stats.weeklyData}>
                      <XAxis 
                        dataKey="week" 
                        stroke="#475569" 
                        fontSize={11}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis stroke="#475569" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value, name) => [`${value.toFixed(1)}h`, name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Research" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                      <Line type="monotone" dataKey="Teaching" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                      <Line type="monotone" dataKey="Service" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                      <Line type="monotone" dataKey="total" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Total" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* ALLOCATION COMPARISON VIEW */}
        {activeTab === 'allocation' && (
          <div>
            {!stats ? (
              <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚖️</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>No data yet</h3>
                <p style={{ color: '#64748b', margin: 0 }}>Start tracking your hours to compare against your workload allocation.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                  
                  {/* Radar Chart Comparison */}
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                      Allocated vs Actual Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={stats.radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="category" stroke="#94a3b8" fontSize={14} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={12} />
                        <Radar name="Allocated" dataKey="allocated" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                        <Radar name="Actual" dataKey="actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                        <Legend />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          formatter={(value) => `${value.toFixed(1)}%`}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                      Category Breakdown
                    </h3>
                    {['Research', 'Teaching', 'Service'].map(cat => {
                      const diff = stats.allocationDiff[cat];
                      const actual = stats.actualPercentages[cat];
                      const allocated = settings.allocation[cat];
                      const diffClass = Math.abs(diff) < 3 ? 'diff-neutral' : diff > 0 ? 'diff-positive' : 'diff-negative';
                      
                      return (
                        <div key={cat} style={{ marginBottom: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%',
                                background: CATEGORY_COLORS[cat].primary 
                              }} />
                              <span style={{ fontWeight: 500 }}>{cat}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b' }}>
                                {stats.categoryTotals[cat].toFixed(1)}h total
                              </span>
                              <span className={diffClass} style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                                {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="allocation-bar">
                            <div 
                              className="allocation-bar-fill"
                              style={{ 
                                width: `${Math.min(actual, 100)}%`,
                                background: CATEGORY_COLORS[cat].primary
                              }}
                            />
                            <div 
                              className="allocation-bar-marker"
                              style={{ left: `${allocated}%` }}
                              title={`Allocated: ${allocated}%`}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                            <span>Actual: {actual.toFixed(1)}%</span>
                            <span>Allocated: {allocated}%</span>
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ 
                      marginTop: '24px', 
                      padding: '16px', 
                      borderRadius: '12px',
                      background: 'rgba(100, 116, 139, 0.1)',
                      border: '1px solid rgba(100, 116, 139, 0.2)'
                    }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
                        What this means:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
                        {stats.allocationDiff.Research > 5 && (
                          <li style={{ color: '#f87171' }}>You're spending more time on Research than allocated (+{stats.allocationDiff.Research.toFixed(1)}%)</li>
                        )}
                        {stats.allocationDiff.Research < -5 && (
                          <li style={{ color: '#34d399' }}>You have room for more Research time ({stats.allocationDiff.Research.toFixed(1)}%)</li>
                        )}
                        {stats.allocationDiff.Teaching > 5 && (
                          <li style={{ color: '#f87171' }}>Teaching is taking more time than allocated (+{stats.allocationDiff.Teaching.toFixed(1)}%)</li>
                        )}
                        {stats.allocationDiff.Teaching < -5 && (
                          <li style={{ color: '#34d399' }}>You have room for more Teaching time ({stats.allocationDiff.Teaching.toFixed(1)}%)</li>
                        )}
                        {stats.allocationDiff.Service > 5 && (
                          <li style={{ color: '#f87171' }}>Service work is exceeding your allocation (+{stats.allocationDiff.Service.toFixed(1)}%)</li>
                        )}
                        {stats.allocationDiff.Service < -5 && (
                          <li style={{ color: '#34d399' }}>You have room for more Service time ({stats.allocationDiff.Service.toFixed(1)}%)</li>
                        )}
                        {Math.abs(stats.allocationDiff.Research) <= 5 && Math.abs(stats.allocationDiff.Teaching) <= 5 && Math.abs(stats.allocationDiff.Service) <= 5 && (
                          <li style={{ color: '#34d399' }}>Your time distribution closely matches your allocation! ✓</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Weekly Distribution Trend */}
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
                    Weekly Distribution Trend
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
                    How your work distribution has changed over time. Dashed lines show your allocated percentages.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.weeklyData.map(w => {
                      const total = w.Research + w.Teaching + w.Service;
                      return {
                        ...w,
                        ResearchPct: total > 0 ? (w.Research / total) * 100 : 0,
                        TeachingPct: total > 0 ? (w.Teaching / total) * 100 : 0,
                        ServicePct: total > 0 ? (w.Service / total) * 100 : 0,
                        AllocResearch: settings.allocation.Research,
                        AllocTeaching: settings.allocation.Teaching,
                        AllocService: settings.allocation.Service
                      };
                    })}>
                      <XAxis 
                        dataKey="week" 
                        stroke="#475569" 
                        fontSize={11}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis stroke="#475569" fontSize={12} domain={[0, 100]} unit="%" />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value, name) => [`${value.toFixed(1)}%`, name.replace('Pct', '').replace('Alloc', 'Allocated ')]}
                      />
                      <Legend formatter={(value) => value.replace('Pct', '').replace('Alloc', 'Target ')} />
                      <Line type="monotone" dataKey="ResearchPct" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Research %" />
                      <Line type="monotone" dataKey="TeachingPct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Teaching %" />
                      <Line type="monotone" dataKey="ServicePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Service %" />
                      <Line type="monotone" dataKey="AllocResearch" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Research Target" />
                      <Line type="monotone" dataKey="AllocTeaching" stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Teaching Target" />
                      <Line type="monotone" dataKey="AllocService" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Service Target" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* MANAGE TASKS VIEW */}
        {activeTab === 'tasks' && (
          <div>
            <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                💡 <strong>Tip:</strong> Customize these tasks to match your actual work. Add tasks like "Ethics review", "Video recording", "Lab supervision", etc. 
                Removing a task won't delete any hours you've already logged for it.
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.entries(categories).map(([category, tasks]) => (
                <div key={category} className="glass-card" style={{ overflow: 'hidden' }}>
                  <div 
                    className="category-header"
                    style={{ background: `linear-gradient(135deg, ${CATEGORY_COLORS[category].primary}20, ${CATEGORY_COLORS[category].dark}30)` }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[category].primary
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '16px', flex: 1 }}>{category}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{tasks.length} tasks</span>
                  </div>
                  <div style={{ padding: '0 20px 20px' }}>
                    {tasks.map(task => (
                      <div key={task} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                      }}>
                        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>{task}</span>
                        <button
                          onClick={() => removeTask(category, task)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    
                    {editingTask === category ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={e => setNewTaskName(e.target.value)}
                          placeholder="e.g., Ethics review..."
                          onKeyDown={e => e.key === 'Enter' && addTask(category)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            background: 'rgba(15, 23, 42, 0.6)',
                            color: '#e2e8f0',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => addTask(category)}
                          style={{
                            background: CATEGORY_COLORS[category].primary,
                            border: 'none',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setEditingTask(null); setNewTaskName(''); }}
                          style={{
                            background: 'rgba(100, 116, 139, 0.2)',
                            border: 'none',
                            color: '#94a3b8',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingTask(category)}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px dashed rgba(148, 163, 184, 0.3)',
                          background: 'transparent',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontSize: '14px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        + Add Task
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Reset to defaults */}
            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <button
                onClick={() => {
                  if (confirm('Reset all tasks to defaults? This will not delete your logged hours.')) {
                    setCategories(DEFAULT_CATEGORIES);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Reset Tasks to Defaults
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px 32px',
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        textAlign: 'center',
        color: '#475569',
        fontSize: '13px'
      }}>
        <p style={{ margin: 0 }}>
          Based on the Academic Work Tracker by Dr Brendan Keogh & Dr Helen Berents • 
          <span style={{ color: '#64748b' }}> Your data is stored locally in your browser</span>
        </p>
      </footer>
    </div>
  );
}
