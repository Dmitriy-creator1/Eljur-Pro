
import React, { useEffect, useState } from 'react';
import * as DB from './services/db';
import { AppState, User, School, COEFFICIENT_TYPES } from './types';
import Login from './views/Login';
import DirectorDashboard from './views/DirectorDashboard';
import TeacherDashboard from './views/TeacherDashboard';
import StudentDashboard from './views/StudentDashboard';
import CreatorDashboard from './views/CreatorDashboard';
import EmployeeDashboard from './views/EmployeeDashboard';
import Settings from './views/Settings';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';
import * as H from './utils/helpers';
import { Modal, Button } from './components/ui';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

const defaultSchool: School = {
  id: 'school_1',
  name: 'Школа №1',
  directorId: 'u_dir'
};

export const defaultState: AppState = {
  schools: [defaultSchool],
  // Creator is NOT in the default user list until initialized or logged in via secret
  users: [
    {id:'u_creator', schoolId: 'global', fio: 'Создатель', role: 'creator', login: 'creator', password: 'admin'},
    {id:'u_dir', schoolId: 'school_1', fio:'Иванов Иван',role:'director',login:'director',password:'dir123'},
    {id:'u_teacher', schoolId: 'school_1', fio:'Петров Пётр',role:'teacher',login:'teacher',password:'teach123', subjects:['Математика'], classes:['10_A']},
    {id:'s_1', schoolId: 'school_1', fio:'Кузнецов Алексей',role:'student',login:'s10a_1',password:'pass1', class:'10', letter:'A'},
    {id:'u_emp', schoolId: 'school_1', fio:'Сидоров Сидр', role:'employee', customRole:'Лаборант', login:'emp', password:'123'}
  ],
  userOrder: ['u_dir', 'u_teacher', 'u_emp', 's_1'],
  classes: [{class:'10', letter:'A'}],
  subjects: ['Математика','Русский','Физика'],
  schedules: {},
  homework: [],
  messages: [],
  announcements: [],
  grades: {},
  finalGrades: {}, 
  teacherAssignments: [], // New
  studentGroups: [], // New
  // Default Grading Settings
  gradingSystem: {
      minGrade: 2,
      maxGrade: 5,
      useWeights: true,
      minWeight: 1,
      maxWeight: 10
  },
  gradeTypes: [], // Initialized in useEffect logic below
  subjectRequirements: {},
  quarters: {Q1:[],Q2:[],Q3:[],Q4:[]},
  settings: {theme:'light', language: 'ru', showSeasonalAnimations: true},
  scheduleSettings: {
      daysToAddBatch: 1,
      skippedWeekDays: [0], // Default skip Sunday
      holidays: [],
      vacations: [],
      quarterDefinitions: {
          'Q1': { start: '', end: '' },
          'Q2': { start: '', end: '' },
          'Q3': { start: '', end: '' },
          'Q4': { start: '', end: '' }
      }
  }
};

// Memoized background component to prevent re-renders when inputs change
const SeasonalBackground = React.memo(({ enabled, timeOffset }: { enabled: boolean, timeOffset?: number }) => {
    if (!enabled) return null;

    // Use Virtual Time for seasonal effects
    const now = new Date(Date.now() + (timeOffset || 0));
    const month = now.getMonth(); // 0-11
    
    // Helper for random numbers
    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // Winter: Dec (11), Jan (0), Feb (1)
    if (month === 11 || month === 0 || month === 1) {
        // Snowflakes: Negative delay fixes initial freeze
        const snow = Array.from({ length: 40 }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(10, 20)}px`
        }));
        
        return (
            <>
                {snow.map(s => (
                    <div key={`s-${s.id}`} className="season-element season-snowflake" style={{ left: s.left, animationDuration: s.duration, animationDelay: s.delay, fontSize: s.size }}>❄</div>
                ))}
            </>
        );
    }
    
    // Spring: Mar (2), Apr (3), May (4)
    if (month >= 2 && month <= 4) {
        const petals = Array.from({ length: 25 }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            width: `${random(8, 15)}px`,
            height: `${random(10, 18)}px`
        }));

        return (
            <>
                {petals.map(p => (
                    <div key={`p-${p.id}`} className="season-petal" style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.width, height: p.height }}></div>
                ))}
            </>
        );
    }

    // Summer: Jun (5), Jul (6), Aug (7)
    if (month >= 5 && month <= 7) {
        const summerElements = Array.from({ length: 40 }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(12, 25)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(6, 14)}px`,
            isLeaf: Math.random() > 0.5
        }));

        return (
            <>
                {summerElements.map(p => (
                    <div key={`sum-${p.id}`} className={p.isLeaf ? "season-summer-leaf" : "season-pollen"} style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.size, height: p.size }}></div>
                ))}
            </>
        );
    }

    // Autumn: Sep (8), Oct (9), Nov (10)
    if (month >= 8 && month <= 10) {
        const leaves = Array.from({ length: 20 }).map((_, i) => {
            const colors = [
                ['#fb923c', '#ea580c'], // orange
                ['#fcd34d', '#d97706'], // yellow-orange
                ['#f87171', '#dc2626'], // red
                ['#b45309', '#78350f']  // brown
            ];
            const colorPair = colors[Math.floor(random(0, colors.length))];
            return {
                id: i,
                left: `${random(0, 90)}vw`,
                duration: `${random(12, 22)}s`,
                delay: `${random(-15, 0)}s`,
                size: `${random(8, 14)}px`,
                color1: colorPair[0],
                color2: colorPair[1]
            };
        });

        return (
            <>
                {leaves.map(l => (
                    <div key={`la-${l.id}`} className="season-autumn-leaf" style={{ 
                        left: l.left, 
                        animationDuration: l.duration, 
                        animationDelay: l.delay, 
                        width: l.size, 
                        height: l.size,
                        '--leaf-color-1': l.color1,
                        '--leaf-color-2': l.color2
                    } as React.CSSProperties}></div>
                ))}
            </>
        );
    }

    return null;
});

export default function App() {
  const [globalState, setGlobalState] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'dashboard' | 'settings'>('dashboard');
  const [showEljurInfo, setShowEljurInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [customFonts, setCustomFonts] = useState<{name: string, displayName: string}[]>([]);

  // Projected state for the current user's school
  const appState = React.useMemo(() => {
    if (!globalState) return null;
    if (!currentUser) return globalState as AppState; // Login screen sees global

    if (currentUser.role === 'creator') {
        const merged: any = { ...globalState };
        merged.classes = [];
        merged.subjects = [];
        merged.schedules = {};
        merged.grades = {};
        merged.finalGrades = {};
        merged.homework = [];
        merged.messages = [];
        merged.announcements = [];
        merged.teacherAssignments = [];
        merged.studentGroups = [];
        merged.gradingSystem = { minGrade: 2, maxGrade: 5, useWeights: true, minWeight: 1, maxWeight: 10 };
        merged.gradeTypes = [];
        merged.subjectRequirements = {};
        merged.quarters = {Q1:[],Q2:[],Q3:[],Q4:[]};
        merged.scheduleSettings = { daysToAddBatch: 1, skippedWeekDays: [0], holidays: [], vacations: [], quarterDefinitions: { 'Q1': { start: '', end: '' }, 'Q2': { start: '', end: '' }, 'Q3': { start: '', end: '' }, 'Q4': { start: '', end: '' } } };
        
        Object.entries(globalState.schoolData || {}).forEach(([sId, sd]: [string, any]) => {
             if (sd.classes) merged.classes.push(...sd.classes.map((c: any) => ({...c, class: `${sId}__${c.class}`})));
             if (sd.subjects) merged.subjects.push(...sd.subjects.map((s: string) => `${sId}__${s}`));
             if (sd.grades) Object.keys(sd.grades).forEach(k => merged.grades[`${sId}__${k}`] = sd.grades[k]);
             if (sd.schedules) Object.keys(sd.schedules).forEach(k => merged.schedules[`${sId}__${k}`] = sd.schedules[k]);
             if (sd.finalGrades) Object.keys(sd.finalGrades).forEach(k => merged.finalGrades[`${sId}__${k}`] = sd.finalGrades[k]);
             if (sd.homework) merged.homework.push(...sd.homework.map((h:any) => ({...h, class: `${sId}__${h.class}`})));
             if (sd.messages) merged.messages.push(...sd.messages);
             if (sd.announcements) merged.announcements.push(...sd.announcements);
             if (sd.teacherAssignments) merged.teacherAssignments.push(...sd.teacherAssignments.map((ta:any) => ({...ta, classId: `${sId}__${ta.classId}`})));
             if (sd.studentGroups) merged.studentGroups.push(...sd.studentGroups.map((g:any) => ({...g, classId: `${sId}__${g.classId}`})));
        });

        merged.users = merged.users.map((u: User) => {
            if (u.role === 'student' && u.class && !u.class.includes('__')) return { ...u, class: `${u.schoolId}__${u.class}` };
            if (u.role === 'teacher' && u.classes) return { ...u, classes: u.classes.map((c: string) => c.includes('__') ? c : `${u.schoolId}__${c}`) };
            return u;
        });
        return merged as AppState;
    }

    const sData = globalState.schoolData?.[currentUser.schoolId] || {
        classes: [], subjects: [], schedules: {}, homework: [], messages: [], announcements: [], grades: {}, finalGrades: {}, teacherAssignments: [], studentGroups: [],
        gradingSystem: { minGrade: 2, maxGrade: 5, useWeights: true, minWeight: 1, maxWeight: 10 },
        gradeTypes: COEFFICIENT_TYPES.map((def:any) => ({ id: H.uid('gt'), key: def.key, name: def.name, weight: def.weight, isDynamicWeight: def.key === 'nu', isNoWeight: def.key === 'n' || def.key === 'op' })),
        subjectRequirements: {},
        quarters: {Q1:[],Q2:[],Q3:[],Q4:[]},
        scheduleSettings: { daysToAddBatch: 1, skippedWeekDays: [0], holidays: [], vacations: [], quarterDefinitions: { 'Q1': { start: '', end: '' }, 'Q2': { start: '', end: '' }, 'Q3': { start: '', end: '' }, 'Q4': { start: '', end: '' } } }
    };

    return {
        ...globalState,
        ...sData,
        users: globalState.users.filter((u: User) => u.schoolId === currentUser.schoolId || u.role === 'creator')
    } as AppState;
  }, [globalState, currentUser]);

  const handleUpdateState = async (newState: AppState) => {
     if (!globalState) return;
     const updatedGlobal = JSON.parse(JSON.stringify(globalState));
     
     if (!currentUser || currentUser.role === 'creator') {
         updatedGlobal.schools = newState.schools;
         updatedGlobal.users = newState.users.map((u: User) => {
             if (u.role === 'student' && u.class && u.class.includes('__')) return { ...u, class: u.class.split('__').pop()! };
             if (u.role === 'teacher' && u.classes) return { ...u, classes: u.classes.map((c: string) => c.includes('__') ? c.split('__').pop()! : c) };
             return u;
         });
         updatedGlobal.userOrder = newState.userOrder;
         updatedGlobal.settings = newState.settings;
         setGlobalState(updatedGlobal);
         await DB.saveState(updatedGlobal);
         return;
     }

     const schoolId = currentUser.schoolId;
     updatedGlobal.schools = newState.schools;
     
     const otherUsers = updatedGlobal.users.filter((u: User) => u.schoolId !== schoolId && u.role !== 'creator');
     const thisUsers = newState.users.filter((u: User) => u.schoolId === schoolId || u.role === 'creator');
     updatedGlobal.users = [...otherUsers, ...thisUsers];
     
     updatedGlobal.userOrder = newState.userOrder;
     updatedGlobal.settings = newState.settings;

     if (!updatedGlobal.schoolData) updatedGlobal.schoolData = {};
     updatedGlobal.schoolData[schoolId] = {
         classes: newState.classes,
         subjects: newState.subjects,
         schedules: newState.schedules,
         homework: newState.homework,
         messages: newState.messages,
         announcements: newState.announcements,
         grades: newState.grades,
         finalGrades: newState.finalGrades,
         teacherAssignments: newState.teacherAssignments,
         studentGroups: newState.studentGroups,
         gradingSystem: newState.gradingSystem,
         gradeTypes: newState.gradeTypes,
         subjectRequirements: newState.subjectRequirements,
         quarters: newState.quarters,
         scheduleSettings: newState.scheduleSettings,
     };

     setGlobalState(updatedGlobal);
     await DB.saveState(updatedGlobal);
  };

  // Initialize Data
  useEffect(() => {
    let unsubscribe: any;
    const init = async () => {
      let loaded = await DB.loadStateOnce();
      if (!loaded) {
        loaded = defaultState;
        await DB.saveState(loaded);
      }
      
      let isFirstSync = true;
      unsubscribe = DB.subscribeToState(async (syncedState) => {
         let loaded = syncedState ? JSON.parse(JSON.stringify(syncedState)) : null;
         if (!loaded) {
             loaded = JSON.parse(JSON.stringify(defaultState));
             await DB.saveState(loaded);
         }

         if (!loaded.schools) {
           loaded.schools = [defaultSchool];
           loaded.users.forEach((u: any) => { if (!u.schoolId) u.schoolId = 'school_1'; });
         }

         // MIGRATION to schoolData
         if (!loaded.schoolData) {
             loaded.schoolData = {};
             // Move all root school data into school_1
             loaded.schoolData['school_1'] = {
                 classes: loaded.classes || [],
                 subjects: loaded.subjects || [],
                 schedules: loaded.schedules || {},
                 homework: loaded.homework || [],
                 messages: loaded.messages || [],
                 announcements: loaded.announcements || [],
                 grades: loaded.grades || {},
                 finalGrades: loaded.finalGrades || {},
                 teacherAssignments: loaded.teacherAssignments || [],
                 studentGroups: loaded.studentGroups || [],
                 gradingSystem: loaded.gradingSystem || { minGrade: 2, maxGrade: 5, useWeights: true, minWeight: 1, maxWeight: 10 },
                 gradeTypes: loaded.gradeTypes || [],
                 subjectRequirements: loaded.subjectRequirements || {},
                 quarters: loaded.quarters || {Q1:[],Q2:[],Q3:[],Q4:[]},
                 scheduleSettings: loaded.scheduleSettings || { daysToAddBatch: 1, skippedWeekDays: [0], holidays: [], vacations: [], quarterDefinitions: { 'Q1': { start: '', end: '' }, 'Q2': { start: '', end: '' }, 'Q3': { start: '', end: '' }, 'Q4': { start: '', end: '' } } }
             };
             
             // Clean up root
             delete loaded.classes;
             delete loaded.subjects;
             delete loaded.schedules;
             delete loaded.homework;
             delete loaded.messages;
             delete loaded.announcements;
             delete loaded.grades;
             delete loaded.finalGrades;
             delete loaded.teacherAssignments;
             delete loaded.studentGroups;
             delete loaded.gradingSystem;
             delete loaded.gradeTypes;
             delete loaded.subjectRequirements;
             delete loaded.quarters;
             delete loaded.scheduleSettings;
             
             if (isFirstSync) DB.saveState(loaded); // Save migration
         }

         if (!loaded.users.find((u: any) => u.role === 'creator')) {
             loaded.users.push({id:'u_creator', schoolId: 'global', fio: 'Создатель', role: 'creator', login: 'creator', password: 'admin'});
         }
         if (!loaded.userOrder) loaded.userOrder = loaded.users.map((u: any) => u.id);

         if (loaded.settings && loaded.settings.showSeasonalAnimations === undefined) { loaded.settings.showSeasonalAnimations = true; }
         
         setGlobalState(loaded);
         if (isFirstSync) {
             isFirstSync = false;
             const sessionStr = localStorage.getItem('eljur_session');
             if (sessionStr) {
                 try {
                     const session = JSON.parse(sessionStr);
                     if (session.expires > Date.now()) {
                         const u = loaded.users.find((user: any) => user.id === session.userId);
                         if (u && (!u.blockedUntil || new Date(u.blockedUntil) <= new Date())) {
                             setCurrentUser(u);
                             if (session.viewMode) setViewMode(session.viewMode);
                             session.expires = Date.now() + 60 * 60 * 1000;
                             localStorage.setItem('eljur_session', JSON.stringify(session));
                         } else {
                             localStorage.removeItem('eljur_session');
                         }
                     } else {
                         localStorage.removeItem('eljur_session');
                     }
                 } catch(e) {
                     localStorage.removeItem('eljur_session');
                 }
             }
             setLoading(false);
         }
      });
    };
    init();
    return () => {
       if (unsubscribe) unsubscribe();
    };
  }, []);

  // Effect to toggle body class for theme
  useEffect(() => {
    if (appState?.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appState?.settings?.theme]);

  // Effect to set HTML lang for native input localization
  useEffect(() => {
    if (appState?.settings?.language) {
      document.documentElement.lang = appState.settings.language;
    }
  }, [appState?.settings?.language]);

  // Effect to Apply Fonts
  useEffect(() => {
    const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const applyFonts = async () => {
        if (!appState?.settings) return;
        const { bodyFontId, headingFontId } = appState.settings;
        const root = document.documentElement;

        // Reset to default first
        root.style.setProperty('--font-body', 'Inter');
        root.style.setProperty('--font-heading', 'Inter');

        if (bodyFontId) {
            try {
                const asset = await DB.getAsset(bodyFontId);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomBodyFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    // Add quotes to ensure CSS variable parses correctly
                    root.style.setProperty('--font-body', '"CustomBodyFont"');
                }
            } catch (e) { console.error("Failed to load body font", e); }
        }

        if (headingFontId) {
            try {
                const asset = await DB.getAsset(headingFontId);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomHeadingFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    // Add quotes to ensure CSS variable parses correctly
                    root.style.setProperty('--font-heading', '"CustomHeadingFont"');
                }
            } catch (e) { console.error("Failed to load heading font", e); }
        }
    };
    applyFonts();
  }, [appState?.settings?.bodyFontId, appState?.settings?.headingFontId]);

  // Effect to load custom fonts for Eljur Info
  useEffect(() => {
    if (!appState) return;
    const loadCustomFonts = async () => {
      const assets = await DB.getAllAssets();
      const fonts = assets.filter(a => a.name.toLowerCase().endsWith('.ttf') || a.name.toLowerCase().endsWith('.woff') || a.name.toLowerCase().endsWith('.woff2'));
      
      const loadedFonts: {name: string, displayName: string}[] = [];
      const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      for (const font of fonts) {
        try {
          const dataUrl = await readBlobAsDataURL(font.blob);
          const fontName = `customfont_${font.id.replace(/[^a-zA-Z0-9]/g, '')}`;
          const fontFace = new FontFace(fontName, `url(${dataUrl})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          loadedFonts.push({ name: fontName, displayName: font.name.replace(/\.[^/.]+$/, "") });
        } catch (e) {
          console.error("Failed to load custom font", e);
        }
      }
      setCustomFonts(loadedFonts);
    };
    loadCustomFonts();
  }, [appState?.settings?.eljurInfo]);

  const handleLogin = (u: User) => {
    setCurrentUser(u);
    setViewMode('dashboard');
    
    const expires = Date.now() + 60 * 60 * 1000;
    localStorage.setItem('eljur_session', JSON.stringify({ userId: u.id, expires, viewMode: 'dashboard' }));
    
    const school = appState?.schools.find(s => s.id === u.schoolId);
    if (school) {
        localStorage.setItem('eljur_last_school_name', school.name);
    }
  };
  const handleLogout = () => {
    setCurrentUser(null);
    setViewMode('dashboard');
    localStorage.removeItem('eljur_session');
  };

  const currentSchool = appState?.schools.find(s => s.id === currentUser?.schoolId);
  const lang = appState?.settings?.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  // Render loading state
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-medium dark:bg-slate-900">{H.t('loading', 'ru')}</div>;
  if (!appState) return <div className="p-10 text-red-600">{H.t('error_state', 'ru')}</div>;

  const showAnimations = appState.settings.showSeasonalAnimations !== false; // Default to true

  const renderEljurInfo = () => {
    const info = appState?.settings?.eljurInfo || (lang === 'ru' ? '<p>Информация отсутствует.</p>' : '<p>No information available.</p>');
    try {
      const parsed = JSON.parse(info);
      if (parsed.isComplex) {
        return (
          <div 
            className="relative bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-3xl mx-auto flex flex-col min-h-[800px]"
            style={parsed.backgroundImage ? {
              backgroundImage: `url(${parsed.backgroundImage})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
              backgroundPosition: 'top center'
            } : {}}
          >
            <style>{`
              ${customFonts.map(f => `
                .ql-font-${f.name} {
                  font-family: "${f.name}", sans-serif;
                }
              `).join('\n')}
              .custom-eljur-info .ql-container.ql-snow {
                border: none !important;
                height: auto !important;
                min-height: 100%;
                flex: 1;
                display: flex;
                flex-direction: column;
                background: transparent !important;
              }
              .custom-eljur-info .ql-editor {
                min-height: 100%;
                flex: 1;
                overflow-y: visible !important;
                padding-bottom: 4px !important;
                background: transparent !important;
              }
              .custom-eljur-info .ql-toolbar {
                opacity: 0;
                pointer-events: none;
                position: sticky;
                top: 0;
                z-index: -1;
              }
            `}</style>
            <ReactQuill 
              theme="snow" 
              value={parsed.quillContent} 
              readOnly={true}
              modules={{
                toolbar: {
                  container: [
                    ['undo', 'redo'],
                    [{ 'font': [false, 'serif', 'monospace', ...customFonts.map(f => f.name)] }, { 'size': ['small', false, 'large', 'huge'] }],
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'video', 'videoUpload'],
                    ['addText'],
                    ['clean']
                  ],
                  handlers: {
                    undo: () => {},
                    redo: () => {},
                    videoUpload: () => {},
                    addText: () => {}
                  }
                }
              }}
              className="custom-eljur-info flex-1 flex flex-col pb-12"
            />
            {parsed.elements.map((el: any) => (
              <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, ...el.style }} className="z-10">
                <div style={{ transform: `rotate(${el.rotation || 0}deg)`, width: '100%', height: '100%' }}>
                  {el.type === 'text' ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(el.content || '') }}
                      className="w-full h-full p-3 bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded shadow-sm overflow-auto"
                    />
                  ) : el.type === 'iframe' ? (
                    <iframe src={el.src} className="w-full h-full object-contain bg-black/5 rounded" allowFullScreen />
                  ) : el.type === 'video' ? (
                    <video src={el.src} controls className="w-full h-full object-contain bg-black/5 rounded" />
                  ) : (
                    <img src={el.src} alt="" className="w-full h-full object-contain rounded" draggable={false} />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Fallback to normal HTML
    }
    return (
      <div className="ql-snow">
        <div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(info) }} />
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 font-sans`}>
      {/* Seasonal Background is rendered here, at the top level, to persist across Login/Dashboard views and avoid reset */}
      <SeasonalBackground enabled={showAnimations} timeOffset={appState.settings.systemTimeOffset} />

      {!currentUser ? (
        <Login users={appState.users} onLogin={handleLogin} schoolName={localStorage.getItem('eljur_last_school_name') || 'ЭлЖур'} settings={appState.settings} onShowInfo={() => setShowEljurInfo(true)} />
      ) : (
        <>
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm dark:bg-slate-900/80 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-18 items-center py-3">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setViewMode('dashboard')}>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setShowEljurInfo(true); }}
                    className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/40 transition-all transform group-hover:scale-105 font-heading"
                  >
                    {lang === 'ru' ? 'Э' : 'E'}
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight dark:text-white font-heading">
                      {currentUser.role === 'creator' ? 'Панель Создателя' : (currentSchool?.name || 'ЭлЖур')}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium dark:text-slate-400">v7 Release</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser.fio}</p>
                    <div className="flex justify-end mt-0.5">
                       <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block dark:bg-slate-800 dark:text-slate-400">
                         {currentUser.role === 'director' ? t('director') : currentUser.role === 'teacher' ? t('teacher') : currentUser.role === 'student' ? t('student') : currentUser.role === 'employee' ? t('employee') : t('creator')}
                       </p>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                  <button 
                    onClick={() => setViewMode(viewMode === 'settings' ? 'dashboard' : 'settings')}
                    className={`p-2.5 rounded-xl transition-all ${viewMode === 'settings' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
                    title={t('settings')}
                  >
                    <SettingsIcon size={20} />
                  </button>

                  <button 
                    onClick={() => setShowLogoutConfirm(true)} 
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                    title={t('exit')}
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">{t('exit')}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
            {viewMode === 'settings' ? (
              <Settings state={appState} onUpdate={handleUpdateState} onBack={() => setViewMode('dashboard')} user={currentUser} />
            ) : (
              <>
                {currentUser.role === 'creator' && (
                  <CreatorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'director' && (
                  <DirectorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'teacher' && (
                  <TeacherDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'student' && (
                  <StudentDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
                {currentUser.role === 'employee' && (
                  <EmployeeDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} />
                )}
              </>
            )}
          </main>
          
          <footer className="py-8 text-center text-slate-400 text-xs no-print border-t border-slate-200 mt-auto bg-white dark:bg-slate-900 dark:border-slate-800 relative z-10">
            &copy; {new Date().getFullYear()} {t('footer_text')}.
          </footer>
          
        </>
      )}

      <Modal isOpen={showEljurInfo} onClose={() => setShowEljurInfo(false)} title={lang === 'ru' ? 'Информация об ЭлЖуре' : 'Eljur Info'} maxWidth="max-w-5xl w-full">
        {renderEljurInfo()}
      </Modal>

      <Modal 
        isOpen={showLogoutConfirm} 
        onClose={() => setShowLogoutConfirm(false)} 
        title={t('confirm_exit_title')}
      >
        <div className="space-y-4 p-1">
          <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            {t('confirm_exit_msg')}
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button 
              variant="primary" 
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }} 
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-md shadow-red-500/20"
            >
              <LogOut size={16} className="mr-1.5" />
              {t('confirm_exit_btn')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
