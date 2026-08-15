const fs = require('fs');
let code = fs.readFileSync('views/admin/UserManagement.tsx', 'utf8');

const replacement = `
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest">{t('manage_classes')}</h3>
            <p className="text-xs text-slate-500 mb-2">Назначение классных руководителей: 1 человек может вести не более 2 классов. На 1 класс назначается 1 руководитель.</p>
          </div>
          <div className="flex flex-wrap gap-3">
`;

code = code.replace(
    /<h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-widest">\{t\('manage_classes'\)\}<\/h3>\s*<div className="flex flex-wrap gap-3">/,
    replacement
);

const selectReplacement = `                <Select
                  value={c.homeroomTeacherId || ""}
                  onChange={(e) => updateHomeroomTeacher(\`\${c.class}_\${c.letter}\`, e.target.value)}
                  className="w-full text-xs py-1 h-auto"
                >
                  <option value="">Без кл. рук.</option>
                  {state.users.filter(u => u.role !== 'student' && u.role !== 'creator').map(u => {
                      const assignedClasses = state.classes.filter(cl => cl.homeroomTeacherId === u.id);
                      const assignedText = assignedClasses.length > 0 ? \` [\${assignedClasses.map(cl => cl.class + cl.letter).join(', ')}]\` : '';
                      const isMaxedOut = assignedClasses.length >= 2;
                      const isAlreadyAssignedToThisClass = c.homeroomTeacherId === u.id;
                      
                      const roleName = u.role === 'teacher' ? t('teacher') : u.role === 'director' ? t('director') : t('employee');

                      return (
                          <option 
                              key={u.id} 
                              value={u.id} 
                              disabled={isMaxedOut && !isAlreadyAssignedToThisClass}
                          >
                              {u.fio} ({roleName}){assignedText}
                          </option>
                      );
                  })}
                </Select>`;

code = code.replace(
    /<Select\s*value=\{c\.homeroomTeacherId \|\| ""\}[\s\S]*?<\/Select>/,
    selectReplacement
);

fs.writeFileSync('views/admin/UserManagement.tsx', code);
console.log('Done');
