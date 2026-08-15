const fs = require('fs');
let code = fs.readFileSync('views/SharedComponents.tsx', 'utf8');

code = code.replace(
    /if \(u\.schoolId !== currentUser\.schoolId && \(u\.role as string\) !== 'creator'\) return;[\s\S]*?let canSee = false;/,
    `if (u.schoolId !== currentUser.schoolId && (u.role as string) !== 'creator') return;

     let canSee = false;

     const myClassInfo = currentUser.role === 'student' ? state.classes.find(c => c.class === currentUser.class && c.letter === currentUser.letter) : null;
     const isMyHomeroomTeacher = myClassInfo?.homeroomTeacherId === u.id;
     const homeroomClasses = state.classes.filter(c => c.homeroomTeacherId === u.id);`
);

code = code.replace(
    /if \(u\.role === 'director'\) canSee = true;\s*\/\/\s*Can see my teachers/,
    `if (u.role === 'director') canSee = true;
         if (isMyHomeroomTeacher) canSee = true;
         // Can see my teachers`
);

code = code.replace(
    /if \(\(u\.role as string\) === 'creator'\) groupName = t\('developer'\);/,
    `if ((u.role as string) === 'creator') groupName = t('developer');
        else if (isMyHomeroomTeacher) groupName = lang === 'ru' ? 'Мой классный руководитель' : 'My Homeroom Teacher';
        else if (homeroomClasses.length > 0) groupName = (lang === 'ru' ? 'Клас. рук. ' : 'Homeroom ') + homeroomClasses.map(c => c.class + c.letter).join(', ');`
);

fs.writeFileSync('views/SharedComponents.tsx', code);
console.log("Regex replaces done.");
