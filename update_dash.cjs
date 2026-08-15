const fs = require('fs');

function addHomeroomToDashboard(file) {
    let code = fs.readFileSync(file, 'utf8');
    
    if (!code.includes('HomeroomView')) {
        code = code.replace("import { Modal, Button } from '../components/ui';", "import { Modal, Button } from '../components/ui';\nimport { HomeroomView } from './shared/HomeroomView';");
        
        // Add tab state
        code = code.replace("view === 'schedule'", "view === 'schedule'");
        code = code.replace(/useState<'([^']+)'(( \| '([^']+)')*)>\(\(\) => {/g, (match, p1, p2) => {
            if (!match.includes('homeroom')) {
                return match.replace(p2, p2 + " | 'homeroom'");
            }
            return match;
        });

        // Add to tabs
        code = code.replace(/<TabButton active=\{view === 'announcements'\}[^>]*\/>/, `$&
        {state.classes.some(c => c.homeroomTeacherId === user.id) && <TabButton active={view === 'homeroom'} onClick={() => handleTabClick('homeroom')} label={lang === 'ru' ? 'Мои классы' : 'Homeroom'} />}`);

        // Add to views
        code = code.replace(/\{view === 'announcements' && <Messaging[^>]*\/>\}/, `$&
        {view === 'homeroom' && <HomeroomView state={state} user={user} />}`);

        fs.writeFileSync(file, code);
        console.log(`Updated ${file}`);
    }
}

addHomeroomToDashboard('views/TeacherDashboard.tsx');
addHomeroomToDashboard('views/EmployeeDashboard.tsx');
addHomeroomToDashboard('views/DirectorDashboard.tsx');
