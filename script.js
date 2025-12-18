/**
 * Strict Project Viewer - Supabase Implementation
 * Corrected to use the Supabase URL and API Key provided.
 */

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; 

let supabaseClient = null;
let currentUser = null;
let authMode = 'login';
let projectsList = [];
let uploadedFilesMap = new Map();
let currentProject = { id: null, name: '', html: '', css: '', js: '', htmlPath: '', cssPath: '', jsPath: '' };

// --- DOM ELEMENTS ---
const get = (id) => document.getElementById(id);
const views = ['view-loading', 'view-auth', 'view-upload', 'view-projects', 'view-workspace', 'view-fullscreen'];

// --- NAVIGATION & VIEW MANAGEMENT ---
function switchView(viewId) {
    views.forEach(v => {
        const el = get(v);
        if (el) el.classList.toggle('active', v === viewId);
    });
}

function closeModal(id) { 
    const el = get(id);
    if (el) el.style.display = 'none'; 
}

function openSaveModal() { 
    const el = get('modal-save');
    if (el) el.style.display = 'flex'; 
}

// --- INITIALIZATION ---
async function init() {
    // Fail-Safe Timer: Hide loading screen if initialization takes too long
    const initTimer = setTimeout(() => {
        if (get('view-loading').classList.contains('active')) {
            switchView('view-auth');
        }
    }, 4000);

    try {
        if (typeof supabase === 'undefined') {
            throw new Error("Supabase library not found.");
        }
        
        // Initialize the client using the provided URL and Key
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Authentication State Listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            clearTimeout(initTimer);
            if (session) {
                currentUser = session.user;
                if (get('user-display')) get('user-display').textContent = currentUser.email;
                fetchProjects();
                switchView('view-upload');
            } else {
                currentUser = null;
                switchView('view-auth');
            }
        });

        // Check for immediate session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            clearTimeout(initTimer);
            switchView('view-auth');
        }

    } catch (err) {
        console.error("Initialization Failed:", err.message);
        clearTimeout(initTimer);
        switchView('view-auth');
    }
}

// --- AUTH ACTIONS ---
window.toggleAuthMode = () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    if (get('auth-title')) get('auth-title').textContent = authMode === 'login' ? 'Welcome Back' : 'Create Account';
    if (get('login-btn')) get('login-btn').style.display = authMode === 'login' ? 'flex' : 'none';
    if (get('signup-btn')) get('signup-btn').style.display = authMode === 'signup' ? 'flex' : 'none';
    if (get('mode-toggle-text')) get('mode-toggle-text').textContent = authMode === 'login' ? 'Sign Up' : 'Log In';
};

window.handleAuthAction = async () => {
    const email = get('auth-email').value;
    const password = get('auth-password').value;
    const errorBox = get('auth-message');
    
    if (errorBox) errorBox.style.display = 'none';
    if (!email || !password) return;

    try {
        let result;
        if (authMode === 'login') {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
        } else {
            result = await supabaseClient.auth.signUp({ email, password });
        }
        if (result.error) throw result.error;
    } catch (err) {
        if (errorBox) {
            errorBox.textContent = err.message;
            errorBox.style.display = 'block';
        }
    }
};

window.userSignOut = () => supabaseClient.auth.signOut();

// --- FILE HANDLING ---
async function processFiles(files) {
    for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        let key = null;
        if (name.endsWith('.html')) key = 'html';
        else if (name.endsWith('.css')) key = 'css';
        else if (name.endsWith('.js')) key = 'js';

        if (key) {
            const content = await file.text();
            uploadedFilesMap.set(key, content);
        }
    }
    updateUploadStatus();
}

function updateUploadStatus() {
    const list = get('file-list-preview');
    if (list) {
        list.innerHTML = '';
        uploadedFilesMap.forEach((v, k) => {
            const item = document.createElement('div');
            item.textContent = `✓ ${k.toUpperCase()} loaded`;
            item.style.color = "var(--success)";
            list.appendChild(item);
        });
    }

    const hasHTML = uploadedFilesMap.has('html');
    if (get('file-count-text')) get('file-count-text').textContent = `${uploadedFilesMap.size} files ready.`;
    if (get('upload-actions')) get('upload-actions').style.display = hasHTML ? 'flex' : 'none';
}

window.resetUploadState = () => {
    uploadedFilesMap.clear();
    updateUploadStatus();
};

// --- PROJECTS & STORAGE ---
async function fetchProjects() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) return;
    projectsList = data;
    renderProjectsList();
}

function renderProjectsList() {
    const container = get('projects-list-grid');
    if (!container) return;
    
    container.innerHTML = '';
    const emptyMsg = get('no-projects-msg');
    if (emptyMsg) emptyMsg.style.display = projectsList.length === 0 ? 'block' : 'none';

    projectsList.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${p.name}</h3>
            <p style="font-size: 0.8rem; color: var(--text-dim);">बनाया गया: ${new Date(p.created_at).toLocaleDateString()}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button class="btn-base btn-primary" onclick="launchProject('${p.id}')">Launch</button>
                <button class="btn-base btn-secondary" onclick="openEditor('${p.id}')">Edit</button>
                <button class="btn-base btn-danger" onclick="deleteProject('${p.id}')" style="grid-column: span 2">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.saveProject = () => openSaveModal();

window.confirmSaveProject = async () => {
    const name = get('project-name-input').value.trim();
    if (!name) return;
    closeModal('modal-save');

    try {
        const folder = `${currentUser.id}/${name.replace(/\s+/g, '_')}`;
        
        const upload = async (key, ext, type) => {
            const content = uploadedFilesMap.get(key);
            if (!content) return null;
            const path = `${folder}/${key}.${ext}`;
            const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(path, new Blob([content], { type }), { upsert: true });
            if (error) throw error;
            return path;
        };

        const [h, c, j] = await Promise.all([
            upload('html', 'html', 'text/html'),
            upload('css', 'css', 'text/css'),
            upload('js', 'js', 'application/javascript')
        ]);

        const { error: dbError } = await supabaseClient.from('projects').insert([{ 
            user_id: currentUser.id, 
            name: name, 
            html: h, 
            css: c, 
            js: j 
        }]);

        if (dbError) throw dbError;

        resetUploadState();
        fetchProjects();
    } catch (err) {
        alert("Upload Error: " + err.message);
    }
};

// --- EDITOR LOGIC ---
window.setEditorTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ['edit-html', 'edit-css', 'edit-js'].forEach(id => {
        const el = get(id);
        if (el) el.classList.toggle('active', id === `edit-${tab}`);
    });
};

window.updatePreview = () => {
    const h = get('edit-html').value;
    const c = get('edit-css').value;
    const j = get('edit-js').value;
    const content = `<html><head><style>${c}</style></head><body>${h}<script>${j}<\/script></body></html>`;
    const frame = get('preview-frame');
    if (frame) frame.srcdoc = content;
};

window.openEditor = async (id) => {
    switchView('view-workspace');
    if (get('save-changes-btn')) get('save-changes-btn').style.display = id ? 'flex' : 'none';

    if (id) {
        const p = projectsList.find(x => x.id === id);
        currentProject = { ...p };
        if (get('workspace-project-name')) get('workspace-project-name').textContent = `Editing: ${p.name}`;
        
        const dl = async (path) => {
            if (!path) return '';
            const { data, error } = await supabaseClient.storage.from(BUCKET_NAME).download(path);
            if (error) return '';
            return await data.text();
        };
        
        const [h, c, j] = await Promise.all([dl(p.html), dl(p.css), dl(p.js)]);
        get('edit-html').value = h; 
        get('edit-css').value = c; 
        get('edit-js').value = j;
    } else {
        get('edit-html').value = uploadedFilesMap.get('html') || '';
        get('edit-css').value = uploadedFilesMap.get('css') || '';
        get('edit-js').value = uploadedFilesMap.get('js') || '';
        if (get('workspace-project-name')) get('workspace-project-name').textContent = "Local Preview";
    }
    updatePreview();
};

window.saveCodeChanges = async () => {
    if (!currentProject.id) return;
    try {
        const update = async (path, content, type) => {
            if (!path) return;
            const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(path, new Blob([content], { type }), { upsert: true });
            if (error) throw error;
        };
        await Promise.all([
            update(currentProject.html, get('edit-html').value, 'text/html'),
            update(currentProject.css, get('edit-css').value, 'text/css'),
            update(currentProject.js, get('edit-js').value, 'application/javascript')
        ]);
        alert("Changes saved successfully!");
    } catch (err) { alert("Save Error: " + err.message); }
};

window.launchProject = async (id) => {
    const p = projectsList.find(x => x.id === id);
    if (!p) return;
    switchView('view-fullscreen');
    
    const dl = async (path) => {
        if (!path) return '';
        const { data } = await supabaseClient.storage.from(BUCKET_NAME).download(path);
        return await data.text();
    };
    
    const [h, c, j] = await Promise.all([dl(p.html), dl(p.css), dl(p.js)]);
    const frame = get('fullscreen-frame');
    if (frame) frame.srcdoc = `<html><head><style>${c}</style></head><body>${h}<script>${j}<\/script></body></html>`;
};

window.deleteProject = async (id) => {
    if (!confirm("Permanently delete this project?")) return;
    try {
        const p = projectsList.find(x => x.id === id);
        const files = [p.html, p.css, p.js].filter(f => f);
        if (files.length > 0) await supabaseClient.storage.from(BUCKET_NAME).remove(files);
        await supabaseClient.from('projects').delete().eq('id', id);
        fetchProjects();
    } catch (err) { alert("Delete Error: " + err.message); }
};

// --- INITIALIZATION ---
window.onload = () => {
    init();
    if (get('file-input')) get('file-input').onchange = (e) => processFiles(e.target.files);
    if (get('folder-input')) get('folder-input').onchange = (e) => processFiles(e.target.files);
    
    const zone = get('drop-zone');
    if (zone) {
        zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; };
        zone.ondragleave = () => { zone.style.borderColor = 'var(--border)'; };
        zone.ondrop = (e) => { 
            e.preventDefault(); 
            zone.style.borderColor = 'var(--border)'; 
            if (e.dataTransfer.files) processFiles(e.dataTransfer.files); 
        };
    }
};

window.switchView = switchView;
window.closeModal = closeModal;

