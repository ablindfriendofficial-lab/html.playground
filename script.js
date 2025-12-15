// Supabase Configuration
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; 

let supabase = null;
let userId = null; 

// State
let uploadedFilesMap = new Map(); 
let currentProject = { id: null, name: '', html: '', css: '', js: '', htmlPath: null, cssPath: null, jsPath: null };
let projectsList = []; 
let authMode = 'login'; 

// DOM Elements
const viewLoading = document.getElementById('view-loading');
const viewUpload = document.getElementById('view-upload');
const viewProjects = document.getElementById('view-projects');
const viewWorkspace = document.getElementById('view-workspace');
const viewAuth = document.getElementById('view-auth');

const miniFileList = document.getElementById('mini-file-list');
const fileCountDisplay = document.getElementById('file-count');
const errorDisplay = document.getElementById('error-display'); // Warning Box
const missingListUl = document.getElementById('missing-list'); // Missing items list

const saveProjectBtn = document.getElementById('save-project-btn'); 
const openEditorBtn = document.getElementById('open-editor-btn'); 

const projectsListContainer = document.getElementById('projects-list');
const previewFrame = document.getElementById('preview-frame');

const editorHtml = document.createElement('textarea'); 
const editorCss = document.createElement('textarea');
const editorJs = document.createElement('textarea');

const saveModalOverlay = document.getElementById('save-modal-overlay');
const projectNameInput = document.getElementById('project-name-input');

// Auth Elements
const authTitle = document.getElementById('auth-title');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const modeToggleText = document.getElementById('mode-toggle-text');

// --- NAVIGATION ---
function _switchViewVisual(viewId) {
    [viewLoading, viewUpload, viewProjects, viewWorkspace, viewAuth].forEach(view => {
        if (view) view.classList.remove('active');
    });
    const activeView = document.getElementById(viewId);
    if (activeView) activeView.classList.add('active');
}

function navigate(viewId, pushState = true) {
    if (pushState && window.location.hash !== `#${viewId}`) {
        history.pushState({ viewId: viewId }, '', `#${viewId}`);
    }
    _switchViewVisual(viewId);
}

window.switchView = function(viewId) { navigate(viewId, true); }
window.addEventListener('popstate', (event) => {
    const viewId = event.state && event.state.viewId ? event.state.viewId : (userId ? 'view-upload' : 'view-auth');
    navigate(viewId, false);
});

// --- INITIALIZATION ---
async function initSupabase() {
    try {
        if (!window.supabase) return;
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') handleAuthChange(session);
            else if (event === 'SIGNED_OUT') handleAuthChange(null);
        });
        
        const { data: { session } } = await supabase.auth.getSession();
        const initialHash = window.location.hash ? window.location.hash.substring(1) : (session ? 'view-upload' : 'view-auth');

        if (session) {
            handleAuthChange(session);
            navigate(initialHash, false); 
        } else {
            handleAuthChange(null);
            navigate('view-auth', false);
        }
    } catch (error) { console.error(error); }
}

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        navigate('view-upload', true); 
    } else {
        userId = null;
        toggleAuthMode('login'); 
        navigate('view-auth', true); 
    }
}

// --- AUTH ACTIONS ---
window.toggleAuthMode = function() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    authTitle.textContent = authMode === 'login' ? 'Log In' : 'Sign Up';
    authMessage.style.display = 'none';
    
    if (authMode === 'login') {
        loginBtn.style.display = 'flex'; signupBtn.style.display = 'none';
        modeToggleText.textContent = 'Sign Up';
    } else {
        signupBtn.style.display = 'flex'; loginBtn.style.display = 'none';
        modeToggleText.textContent = 'Log In';
    }
}

window.handleAuthAction = async function() {
    const email = authEmail.value;
    const password = authPassword.value;
    if (!email || !password) return;
    
    let result;
    if (authMode === 'login') result = await supabase.auth.signInWithPassword({ email, password });
    else result = await supabase.auth.signUp({ email, password });
    
    if (result.error) {
        authMessage.textContent = result.error.message;
        authMessage.style.display = 'block';
    } else if (authMode === 'signup' && !result.data.user) {
        authMessage.textContent = 'Check email for confirmation.';
        authMessage.style.color = 'var(--success)';
        authMessage.style.display = 'block';
    }
}

window.userSignOut = async () => { await supabase.auth.signOut(); }

// --- FILE PROCESSING ---
window.addEventListener('load', () => {
    initSupabase();
    const folderInput = document.getElementById('folder-input');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    if (folderInput) folderInput.addEventListener('change', (e) => processFiles(e.target.files));
    if (fileInput) fileInput.addEventListener('change', (e) => processFiles(e.target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    });
    dropZone.addEventListener('drop', (e) => processFiles(e.dataTransfer.items));
});

async function processFiles(input) {
    let newFiles = [];
    if (input instanceof DataTransferItemList) {
        for (let i=0; i<input.length; i++) if (input[i].kind === 'file') newFiles.push(input[i].getAsFile());
    } else {
        newFiles = Array.from(input);
    }
    
    if (newFiles.length === 0) return;

    const readPromises = newFiles.map(file => {
        return new Promise((resolve) => {
            if (!file || file.name.startsWith('.')) return resolve();
            
            const originalName = file.name.toLowerCase();
            let key = null;
            if (originalName.includes('index') || originalName.endsWith('.html')) key = 'index.html';
            else if (originalName.includes('style') || originalName.endsWith('.css')) key = 'style.css';
            else if (originalName.includes('script') || originalName.endsWith('.js')) key = 'script.js';
            
            if (key) {
                const reader = new FileReader();
                reader.onload = (e) => { uploadedFilesMap.set(key, e.target.result); resolve(); };
                reader.readAsText(file);
            } else {
                resolve();
            }
        });
    });

    await Promise.all(readPromises);
    updateMiniList();
    validateProject(); // Check for missing files immediately
}

function updateMiniList() {
    miniFileList.innerHTML = '';
    let count = 0;
    uploadedFilesMap.forEach((_, key) => {
        const li = document.createElement('li');
        li.textContent = key;
        miniFileList.appendChild(li);
        count++;
    });
    miniFileList.style.display = count > 0 ? 'block' : 'none';
    fileCountDisplay.textContent = `${count} files found.`;
}

// --- SMART VALIDATION LOGIC ---
function validateProject() {
    const missing = [];
    if (!uploadedFilesMap.has('index.html')) missing.push('index.html');
    if (!uploadedFilesMap.has('style.css')) missing.push('style.css');
    if (!uploadedFilesMap.has('script.js')) missing.push('script.js');

    // Show warning ONLY if at least 1 file exists AND something is missing
    // If Map is empty (fresh start/clear), hide error.
    if (uploadedFilesMap.size > 0 && missing.length > 0) {
        errorDisplay.style.display = 'block';
        missingListUl.innerHTML = '';
        missing.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file;
            missingListUl.appendChild(li);
        });
    } else {
        // Hide if complete OR empty
        errorDisplay.style.display = 'none';
    }
}

// --- PREVIEW & EDITOR ---
window.openEditor = async function(projectId) {
    let h='', c='', j='';
    
    if (projectId) {
        // Saved project logic omitted for brevity in local focus
    } else {
        // Load LOCAL files
        currentProject.id = null;
        currentProject.name = 'New Upload';
        h = uploadedFilesMap.get('index.html') || '<h1>No HTML Found</h1>';
        c = uploadedFilesMap.get('style.css') || '';
        j = uploadedFilesMap.get('script.js') || '';
    }
    
    const blob = new Blob([`
        <!DOCTYPE html><html><head><style>${c}</style></head>
        <body>${h}<script>${j}<\/script></body></html>
    `], { type: 'text/html' });
    
    previewFrame.src = URL.createObjectURL(blob);
    navigate('view-workspace', true);
}

window.refreshPreview = function() { window.openEditor(null); }

// --- STORAGE HELPERS ---
async function uploadProjectComponent(bucket, path, content, type) {
    if(!content) return null;
    const { data, error } = await supabase.storage.from(bucket).upload(path, new Blob([content], {type}), { upsert: true });
    if(error) throw error;
    return data.path;
}

// --- SAVE LOGIC ---
window.saveProject = function() {
    projectNameInput.value = currentProject.name === 'New Upload' ? '' : currentProject.name;
    saveModalOverlay.style.display = 'flex';
}
window.cancelSave = () => saveModalOverlay.style.display = 'none';

window.confirmSaveProject = async function() {
    const name = projectNameInput.value.trim();
    if(!name) return;
    saveModalOverlay.style.display = 'none';
    
    try {
        const pathBase = `${userId}/${name}`;
        const h = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/index.html`, uploadedFilesMap.get('index.html'), 'text/html');
        const c = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/style.css`, uploadedFilesMap.get('style.css'), 'text/css');
        const j = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/script.js`, uploadedFilesMap.get('script.js'), 'application/javascript');
        
        await supabase.from('projects').insert([{ user_id: userId, name: name, html: h, css: c, js: j }]);
        alert('Project Saved!');
        resetUploadState();
    } catch(e) {
        alert('Save Failed: ' + e.message);
    }
}

window.resetUploadState = function() {
    uploadedFilesMap.clear();
    updateMiniList();
    validateProject(); // This will now hide the warning since map size is 0
}


