
import React, { useState, useEffect } from 'react';
import { AppState, User } from '../types';
import { Messaging } from './SharedComponents';
import * as H from '../utils/helpers';
import { UserManagement } from './admin/UserManagement';
import { ScheduleEditor } from './admin/ScheduleEditor';
import { StudentRating } from './shared/StudentRating';
import { TeacherLoadManager } from './admin/TeacherLoadManager';
import { GroupManager } from './admin/GroupManager';
import { GradingSetup } from './admin/GradingSetup';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
}

export default function EmployeeDashboard({ state, onUpdate, user }: Props) {
  const allowedTabs = user.employeePermissions?.allowedTabs || ['messages']; 
  const [view, setView] = useState<string>(() => {
    return (localStorage.getItem(`eljur_tab_${user.id}`) as string) || allowedTabs[0] || 'messages';
  });
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const unreadMessagesCount = H.getUnreadMessagesCount(state, user);
  const unreadAnnouncementsCount = H.getUnreadAnnouncementsCount(state, user);

  useEffect(() => {
     if (!allowedTabs.includes(view)) {
         setView(allowedTabs[0] || '');
     }
  }, [allowedTabs, view]);

  useEffect(() => {
    localStorage.setItem(`eljur_tab_${user.id}`, view);
  }, [view, user.id]);

  if (allowedTabs.length === 0) {
      return <div className="p-10 text-center text-slate-500">Нет доступных вкладок. Обратитесь к директору.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex overflow-x-auto hide-scrollbar gap-1 no-print w-full dark:bg-slate-900 dark:border-slate-800 pb-2 sm:pb-1.5">
        {allowedTabs.includes('messages') && <TabButton active={view === 'messages'} onClick={() => setView('messages')} label={t('messages')} badgeCount={unreadMessagesCount} />}
        {allowedTabs.includes('announcements') && <TabButton active={view === 'announcements'} onClick={() => setView('announcements')} label={t('announcements')} badgeCount={unreadAnnouncementsCount} />}
        {allowedTabs.includes('rating') && <TabButton active={view === 'rating'} onClick={() => setView('rating')} label={t('rating')} />}
        {allowedTabs.includes('schedule') && <TabButton active={view === 'schedule'} onClick={() => setView('schedule')} label={t('schedule')} />}
        {allowedTabs.includes('users') && <TabButton active={view === 'users'} onClick={() => setView('users')} label={t('users')} />}
        {allowedTabs.includes('load') && <TabButton active={view === 'load'} onClick={() => setView('load')} label={t('teacher_load')} />}
        {allowedTabs.includes('groups') && <TabButton active={view === 'groups'} onClick={() => setView('groups')} label={t('groups')} />}
        {allowedTabs.includes('grading') && <TabButton active={view === 'grading'} onClick={() => setView('grading')} label={t('grading_setup')} />}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
        {view === 'homeroom' && <HomeroomView state={state} user={user} />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'schedule' && <ScheduleEditor state={state} onUpdate={onUpdate} />}
        {view === 'users' && <UserManagement state={state} onUpdate={onUpdate} currentUser={user} isGlobal={false} />}
        {view === 'load' && <TeacherLoadManager state={state} onUpdate={onUpdate} />}
        {view === 'groups' && <GroupManager state={state} onUpdate={onUpdate} />}
        {view === 'grading' && <GradingSetup state={state} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}

const TabButton = ({ active, onClick, label, badgeCount }: { active: boolean; onClick: () => void; label: string; badgeCount?: number }) => (
  <button
    onClick={onClick}
    className={`flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    <span>{label}</span>
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full leading-none transition-transform duration-200 ${
        active 
          ? 'bg-white text-blue-600 shadow-sm' 
          : 'bg-red-500 text-white shadow-sm'
      }`}>
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    )}
  </button>
);
