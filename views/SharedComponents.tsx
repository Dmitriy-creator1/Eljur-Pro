

import React, { useState } from 'react';
import { AppState, User, Message, Attachment } from '../types';
import * as H from '../utils/helpers';
import * as DB from '../services/db';
import { Button, Input, Card, FileDisplay, MultiFileUploader, SearchableSelect, Select } from '../components/ui';
import { Trash2, Edit, Shield } from 'lucide-react';

interface MessagingProps {
  state: AppState;
  onUpdate: (s: AppState) => void;
  currentUser: User;
  type: 'messages' | 'announcements';
}

export const Messaging: React.FC<MessagingProps> = ({ state, onUpdate, currentUser, type }) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  // Recipients: Can be UserID or GroupKey (e.g., 'GROUP_TEACHERS')
  const [composeTo, setComposeTo] = useState<string[]>([]);
  
  const [files, setFiles] = useState<File[]>([]);
  
  // Send As Director logic for employees
  const [sendAsDirector, setSendAsDirector] = useState(false);
  
  // Edit Mode
  const [editId, setEditId] = useState<string | null>(null);

  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const isDirector = currentUser.role === 'director';
  const isCreator = currentUser.role === 'creator';
  const isEmployee = currentUser.role === 'employee';
  const isAnnounce = type === 'announcements';

  // Find director ID for "Send As" logic
  const director = state.users.find(u => u.schoolId === currentUser.schoolId && u.role === 'director');

  const handleSend = async () => {
    if (!composeTitle || !composeBody) return alert(t('fill_topic_text'));
    if (!isAnnounce && composeTo.length === 0) return alert(t('select_recipient_alert'));

    const newAttachments: Attachment[] = [];
    for (const f of files) {
       const id = H.uid('att');
       await DB.saveAsset(id, f.name, f.type, f);
       newAttachments.push({ id, name: f.name, type: f.type });
    }

    // RESOLVE RECIPIENTS (GROUPS -> INDIVIDUALS)
    let finalToIds: string[] = [];
    if (!isAnnounce) {
       composeTo.forEach(val => {
           if (val === 'GROUP_TEACHERS') {
              // Only teachers in SAME school
              finalToIds.push(...state.users.filter(u => u.role === 'teacher' && u.schoolId === currentUser.schoolId).map(u => u.id));
           } else if (val.startsWith('GROUP_CLASS_')) {
              const classKey = val.replace('GROUP_CLASS_', ''); // 10_A
              finalToIds.push(...state.users.filter(u => u.role === 'student' && u.schoolId === currentUser.schoolId && `${u.class}_${u.letter}` === classKey).map(u => u.id));
           } else {
              finalToIds.push(val); // Single User ID
           }
       });
       // Unique IDs
       finalToIds = Array.from(new Set(finalToIds));
    }

    // Determine Sender ID
    let fromId = currentUser.id;
    let realAuthorId: string | undefined = undefined;

    // Logic: Employee always has option to send as Director if they have access to this tab
    if (sendAsDirector && isEmployee && director && currentUser.employeePermissions?.canSendAsDirector) {
        fromId = director.id;
        realAuthorId = currentUser.id;
    }

    if (editId) {
      // Edit existing
      const list = isAnnounce ? state.announcements : state.messages;
      const idx = list.findIndex(m => m.id === editId);
      if (idx > -1) {
         const existing = list[idx];
         // Append new
         const mergedAtts = [...(existing.attachments || []), ...newAttachments];
         if (existing.attachmentId) mergedAtts.push({id:existing.attachmentId, name:existing.attachmentName||'', type:''});
         
         const updated: Message = {
            ...existing,
            title: composeTitle,
            body: composeBody,
            attachments: mergedAtts,
            // clean legacy
            attachmentId: undefined
         };
         if (!isAnnounce) updated.toIds = finalToIds;

         list[idx] = updated;
      }
      setEditId(null);
    } else {
      // Create New
      const newItem: Message = {
        id: H.uid(isAnnounce ? 'ann' : 'msg'),
        fromId: fromId,
        realAuthorId: realAuthorId,
        toIds: isAnnounce ? [] : finalToIds, // Announcements are public/broadcast
        title: composeTitle,
        body: composeBody,
        attachments: newAttachments,
        date: new Date().toISOString()
      };

      if (isAnnounce) {
        state.announcements.push(newItem);
      } else {
        state.messages.push(newItem);
      }
    }

    onUpdate(state);
    setComposeTitle('');
    setComposeBody('');
    setFiles([]);
    setComposeTo([]);
    setSendAsDirector(false);
    setActiveTab('sent');
  };

  const startEdit = (m: Message) => {
     setComposeTitle(m.title);
     setComposeBody(m.body);
     setComposeTo(m.toIds); // This puts IDs back. Groups are lost visually but functionality remains valid.
     setFiles([]); 
     setEditId(m.id);
     setActiveTab('compose');
  };

  const cancelEdit = () => {
    setEditId(null);
    setComposeTitle('');
    setComposeBody('');
    setFiles([]);
    setComposeTo([]);
    setSendAsDirector(false);
    setActiveTab('sent');
  };

  const deleteItem = (id: string) => {
     if(!confirm(t('delete_msg_confirm'))) return;
     if (isAnnounce) {
        state.announcements = state.announcements.filter(m => m.id !== id);
     } else {
        state.messages = state.messages.filter(m => m.id !== id);
     }
     onUpdate(state);
  };

  const getFilteredItems = () => {
    const list = isAnnounce ? state.announcements : state.messages;
    if (activeTab === 'sent') {
      return list.filter(m => {
          // I see messages I sent as myself
          if (m.fromId === currentUser.id) return true;
          // I see messages I sent on behalf of director
          if (m.realAuthorId === currentUser.id) return true;
          return false;
      }).reverse();
    } else {
      // Inbox
      if (isAnnounce) {
        return list.filter(m => {
            const sender = state.users.find(u => u.id === m.fromId);
            if (!sender) return false;
            // Use cast to avoid type errors with Role 'creator'
            if ((sender.role as string) === 'creator') return true; // Global announcement
            if (sender.schoolId === currentUser.schoolId) return true; // My school
            return false;
        }).reverse();
      } else {
        // Direct messages to me
        return list.filter(m => (m.toIds || []).includes(currentUser.id)).reverse();
      }
    }
  };

  const items = getFilteredItems();

  // Logic for searchable select options
  const userOptions: {value:string, label:string, group:string}[] = [];
  
  // Scopes
  const employeeScopes = currentUser.employeePermissions?.messagingScope || [];
  
  // KEY CHANGE: If employee is writing AS DIRECTOR, they get full scope.
  // If writing as SELF, they use their messagingScope.
  const actingAsDirector = isDirector || (isEmployee && sendAsDirector);
  const actingAsRestrictedEmployee = isEmployee && !sendAsDirector;
  const isAdministrationEmployee = isEmployee && currentUser.employeePermissions?.isAdministration;

  const canMessageAll = actingAsDirector || 
                        isAdministrationEmployee || // Administration can write to all
                        (actingAsRestrictedEmployee && employeeScopes.includes('ALL')) || 
                        currentUser.role === 'teacher';

  if (isDirector || currentUser.role === 'teacher' || isEmployee) {
     if (isDirector || isEmployee) userOptions.push({ value: 'GROUP_TEACHERS', label: t('all_teachers'), group: t('groups') });
     
     // Classes logic
     const classes = state.classes.filter(c => {
         if (actingAsDirector || isAdministrationEmployee) return true; // Director/Admin sees all
         if (currentUser.role === 'teacher') return currentUser.classes?.includes(`${c.class}_${c.letter}`);
         if (actingAsRestrictedEmployee) {
             if (canMessageAll) return true;
             return employeeScopes.includes(`${c.class}_${c.letter}`);
         }
         return false;
     });
     
     classes.forEach(c => {
         userOptions.push({ value: `GROUP_CLASS_${c.class}_${c.letter}`, label: `${t('whole_class')} ${c.class}${c.letter}`, group: t('groups') });
     });
  }

  // 2. Individuals
  state.users.forEach(u => {
     if (u.id === currentUser.id) return;
     
     // CREATOR Logic - Cast role to string to fix potential type overlap issues
     if ((u.role as string) === 'creator') {
         // Only Directors or Employees with 'canSendAsDirector' permission can write to Creator
         const canContactCreator = isDirector || (isEmployee && currentUser.employeePermissions?.canSendAsDirector);
         
         if (canContactCreator) {
             // NEW: Employee must be in "Director Mode" to see creator
             // If acting as self (restricted), do NOT show Creator.
             if (isEmployee && !sendAsDirector) return;

             userOptions.push({ value: u.id, label: t('creator'), group: t('developer') });
         }
         return; 
     }

     // DIRECTORS can message Creator
     if (isDirector && (u.role as string) === 'creator') {
         // Already handled above, but specific check for Creator -> Director logic if needed
         return; 
     }
     
     // NORMAL SCHOOL LOGIC (Same School Only)
     if (u.schoolId !== currentUser.schoolId && (u.role as string) !== 'creator') return;

     let canSee = false;
     
     if (actingAsDirector || isAdministrationEmployee) {
         canSee = true; // Director/Admin mode sees all (except Creator usually handled above)
     } else if (currentUser.role === 'teacher') {
         if (u.role === 'director' || u.role === 'teacher') canSee = true;
         // Can see employees who are Administration
         if (u.role === 'employee' && u.employeePermissions?.isAdministration) canSee = true;
         // Can see students in my classes
         if (u.role === 'student' && currentUser.classes?.includes(`${u.class}_${u.letter}`)) canSee = true;
     } else if (currentUser.role === 'student') {
         if (u.role === 'director') canSee = true;
         // Can see my teachers
         if (u.role === 'teacher' && u.classes?.includes(`${currentUser.class}_${currentUser.letter}`)) canSee = true;
         // Can see employees who are Administration
         if (u.role === 'employee' && u.employeePermissions?.isAdministration) canSee = true;
         // Can see employees who are assigned to my class
         if (u.role === 'employee' && u.employeePermissions?.messagingScope?.includes(`${currentUser.class}_${currentUser.letter}`)) canSee = true;
     } else if (actingAsRestrictedEmployee) {
         // I am an employee writing as myself (non-admin)
         if (u.role === 'director' || u.role === 'teacher') canSee = true; 
         if (u.role === 'employee') canSee = true; // Other employees
         
         if (u.role === 'student') {
             if (canMessageAll) canSee = true;
             else if (employeeScopes.includes(`${u.class}_${u.letter}`)) canSee = true;
         }
     }

     if (canSee) {
        let groupName = '';
        if ((u.role as string) === 'creator') groupName = t('developer');
        else if (u.role === 'director') groupName = t('administration');
        else if (u.role === 'employee') {
            if (u.employeePermissions?.isAdministration) groupName = t('administration');
            else groupName = t('employees');
        }
        else if (u.role === 'teacher') groupName = t('teachers');
        else groupName = `${t('students')} ${u.class || ''}${u.letter || ''}`;
        
        // Format Label: Short FIO
        let label = H.formatShortName(u.fio);
        
        // Add Suffixes
        if (u.role === 'teacher') {
            // Get subjects from LOAD (teacherAssignments), not just u.subjects
            const assignedSubjects = Array.from(new Set(
                state.teacherAssignments
                    .filter(a => a.teacherId === u.id)
                    .map(a => a.subject)
            ));
            
            if (assignedSubjects.length > 0) {
                label += ` (${assignedSubjects.join(', ')})`;
            }
        } else if (u.role === 'director') {
            label += ` (${t('director')})`;
        } else if (u.customRole) {
            label += ` (${u.customRole})`;
        }

        userOptions.push({ value: u.id, label: label, group: groupName });
     }
  });

  // Check if we should show full control buttons (Sent, Compose)
  // Employee gets full controls if they are allowed in this tab (which they are if they are here)
  const showControls = isDirector || isCreator || isEmployee || !isAnnounce;

  return (
    <div className="space-y-6">
      <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex flex-wrap gap-1 dark:bg-slate-900 dark:border-slate-800">
        <button 
          onClick={() => { setActiveTab('inbox'); setEditId(null); }} 
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab==='inbox' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          {t('inbox')}
        </button>
        {showControls && (
        <button 
          onClick={() => { setActiveTab('sent'); setEditId(null); }} 
          className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab==='sent' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          {t('sent')}
        </button>
        )}
        {showControls && (
          <button 
            onClick={() => { setActiveTab('compose'); setEditId(null); setComposeTitle(''); setComposeBody(''); setFiles([]); }} 
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab==='compose' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            + {t('write')}
          </button>
        )}
      </div>

      {activeTab === 'compose' ? (
        <Card className="p-8 max-w-2xl shadow-soft">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{editId ? t('editing') : (isAnnounce ? t('new_announcement') : t('new_message'))}</h3>
            {editId && <button onClick={cancelEdit} className="text-red-500 hover:underline text-sm font-semibold">{t('cancel')}</button>}
          </div>
          <div className="space-y-5">
            {/* SEND AS DIRECTOR OPTION - Always available for employee in this tab */}
            {!isAnnounce && isEmployee && currentUser.employeePermissions?.canSendAsDirector && !editId && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30">
                    <label className="block text-sm font-bold text-amber-900 mb-2 dark:text-amber-400 flex items-center gap-2">
                        <Shield size={16}/> {t('send_as')}:
                    </label>
                    <Select value={sendAsDirector ? 'director' : 'self'} onChange={e => {
                        setSendAsDirector(e.target.value === 'director');
                        setComposeTo([]); // Reset recipients when switching mode
                    }}>
                        <option value="self">{currentUser.fio} ({t('me')})</option>
                        <option value="director">{director ? `${director.fio} (${t('director')})` : t('director')}</option>
                    </Select>
                </div>
            )}

            {!isAnnounce && (
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('to_label')}</label>
                <SearchableSelect 
                   multi={true}
                   options={userOptions} 
                   value={composeTo} 
                   onChange={setComposeTo} 
                   placeholder={t('select_recipients_placeholder')}
                   lang={lang as 'ru'|'en'}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('theme')}</label>
              <Input value={composeTitle} onChange={e => setComposeTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 dark:text-slate-300">{t('text')}</label>
              <textarea 
                className="w-full border border-slate-300 rounded-xl p-4 h-36 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
              />
            </div>
            <MultiFileUploader files={files} onFilesChange={setFiles} lang={lang as 'ru'|'en'} />
            <div className="pt-4 flex gap-3">
              <Button variant="primary" onClick={handleSend} className="w-full md:w-auto px-8">{t('send')}</Button>
              {editId && <Button variant="ghost" onClick={cancelEdit}>{t('cancel')}</Button>}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && <p className="text-slate-400 italic text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900 dark:border-slate-800">{t('list_empty')}</p>}
          {items.map(item => {
            const sender = state.users.find(u => u.id === item.fromId);
            const realAuthor = item.realAuthorId ? state.users.find(u => u.id === item.realAuthorId) : null;
            
            const recipients = !isAnnounce ? item.toIds.map(id => state.users.find(u => u.id === id)?.fio).join(', ') : 'Все';
            return (
              <Card key={item.id} className="p-6 hover:shadow-md transition duration-200 border-l-[6px] border-l-blue-500 dark:border-l-blue-600">
                <div className="flex justify-between items-start mb-3">
                   <h4 className="font-bold text-lg text-slate-800 dark:text-white">{item.title}</h4>
                   <div className="flex items-center gap-2">
                       <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded dark:bg-slate-800 dark:text-slate-500">{new Date(item.date).toLocaleString()}</span>
                       {activeTab === 'sent' && (
                         <>
                           <button onClick={() => startEdit(item)} className="text-blue-500"><Edit size={14}/></button>
                           <button onClick={() => deleteItem(item.id)} className="text-red-500"><Trash2 size={14}/></button>
                         </>
                       )}
                   </div>
                </div>
                <div className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100 flex gap-6 dark:border-slate-800 dark:text-slate-400">
                  <span className="flex items-center gap-2">
                      {t('from')}: <span className="font-bold text-slate-700 dark:text-slate-300">{H.formatShortName(sender?.fio || 'Unknown')}</span>
                      {realAuthor && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300" title={`${t('sent_by_emp')}: ${realAuthor.fio}`}>
                             ({t('executed_by')} {H.formatShortName(realAuthor.fio)})
                          </span>
                      )}
                  </span>
                  {activeTab === 'sent' && <span>{t('to')}: <span className="font-bold text-slate-700 dark:text-slate-300">{recipients}</span></span>}
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed dark:text-slate-300">{item.body}</p>
                {item.attachmentId && <FileDisplay id={item.attachmentId} name={item.attachmentName} lang={lang as 'ru'|'en'} />}
                {(item.attachments || []).map((att: Attachment) => <FileDisplay key={att.id} id={att.id} name={att.name} lang={lang as 'ru'|'en'} />)}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
};