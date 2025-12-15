// Supabase client is loaded via CDN link in index.html, so we can use `supabase.createClient` directly.

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; 

let supabase = null;
let userId = null; 

// --- APP STATE ---
let uploadedFilesMap = new Map(); 
let currentProject = { id: null, name: '', html: '', css: '', js: '', htmlPath: null, cssPath: null, jsPath: null };
let projectsList = []; 
let projectIdToDelete = null; 
let authMode = 'login'; 
let currentActiveTab = 'html'; 

// --- DOM ELEMENTS ---
const viewLoading = document.getElementById('view-loading');
const viewUpload = document.getElementById('view-upload');
const viewProjects = document.getElementById('view-projects');
const viewWorkspace = document.getElementById('view-workspace');
const viewFullscreen = document.getElementById('view-fullscreen');
const viewEditor = document.getElementById('view-editor');
const viewAuth = document.getElementById('view-auth');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');

const miniFileList = document.getElementById('mini-file-list');
const fileCountDisplay = document.getElementById('file-count');
const errorDisplay = document.getElementById('error-display'); // The Warning Box
const missingListUl = document.getElementById('missing-list'); // The List inside it
const saveProjectBtn = document.getElementById('save-project-btn'); 
const openEditorBtn = document.getElementById('open-editor-btn'); 

const projectsListContainer = document.getElementById('projects-list');
const noProjectsMessage = document.getElementById('no-projects-message');
const previewFrame = document.getElementById('preview-frame');
const fullscreenFrame = document.getElementById('fullscreen-frame');
const previewProjectName = document.getElementById('preview-project-name');

const editorHtml = document.getElementById('editor-html');
const editorCss = document.getElementById('editor-css');
const editorJs = document.getElementById('editor-js');
const editorProjectName = document.getElementById('editor-project-name');
const editorTabs = document.querySelectorAll('.editor-tab');

const saveModalOverlay = document.getElementById('save-modal-overlay');
const projectNameInput = document.getElementById('project-name-input');
const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const deleteProjectNameDisplay = document.getElementById('delete-project-name');

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
    [viewLoading, viewUpload, viewProjects, viewWorkspace, viewFullscreen, viewAuth].forEach(view => {
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
        if (!window.supabase) {
            console.error("Supabase CDN not loaded.");
            return;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                handleAuthChange(session);
            } else if (event === 'SIGNED_OUT') {
                handleAuthChange(null);
            }
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
    } catch (error) {
        console.error("Init failed:", error);
    }
}

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        const welcomeText = document.querySelector('#view-upload .toolbar-group span');
        if (welcomeText) welcomeText.textContent = `Welcome, ${session.user.email}!`;
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
        loginBtn.style.display = 'flex';
        signupBtn.style.display = 'none';
        modeToggleText.textContent = 'Sign Up';
    } else {
        signupBtn.style.display = 'flex';
        loginBtn.style.display = 'none';
        modeToggleText.textContent = 'Log In';
    }
}

window.handleAuthAction = async function() {
    const email = authEmail.value;
    const password = authPassword.value;
    if (!email || !password) {
        authMessage.textContent = 'Email and password required.';
        authMessage.style.display = 'block';
        return;
    }
    
    let result;
    if (authMode === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
    } else {
        result = await supabase.auth.signUp({ email, password });
    }
    
    if (result.error) {
        authMessage.textContent = result.error.message;
        authMessage.style.display = 'block';
    } else if (authMode === 'signup' && !result.data.user) {
        authMessage.textContent = 'Check email for confirmation link.';
        authMessage.style.color = 'var(--success)';
        authMessage.style.display = 'block';
    }
}

window.userSignOut = async () => { await supabase.auth.signOut(); }

// --- FILE PROCESSING (FIXED) ---
window.addEventListener('load', () => {
    initSupabase();
    if (folderInput) folderInput.addEventListener('change', (e) => processFiles(e.target.files));
    if (fileInput) fileInput.addEventListener('change', (e) => processFiles(e.target.files));
    
    // Drag Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    });
    dropZone.addEventListener('drop', (e) => processFiles(e.dataTransfer.items));
    
    editorTabs.forEach(tab => tab.addEventListener('click', () => switchEditorTab(tab.dataset.tab)));
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
            if (originalName.endsWith('.html')) key = 'index.html';
            else if (originalName.endsWith('.css')) key = 'style.css';
            else if (originalName.endsWith('.js')) key = 'script.js';
            
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
    validateProject();
    updateMiniList();
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

// --- CRITICAL FIX: VALIDATION LOGIC ---
function validateProject() {
    const hasHtml = !!uploadedFilesMap.get('index.html');
    const canSave = hasHtml;

    // 1. Toggle Buttons
    if (saveProjectBtn) saveProjectBtn.disabled = !canSave;
    if (openEditorBtn) openEditorBtn.disabled = !canSave;

    // 2. Toggle Error Box (Fixing "Still Missing" issue)
    if (!hasHtml) {
        errorDisplay.style.display = 'block'; // Show if HTML is missing
        missingListUl.innerHTML = '<li>index.html is required</li>';
    } else {
        errorDisplay.style.display = 'none'; // HIDE completely if HTML is present
    }
}

// --- PREVIEW & EDITOR ---
window.openEditor = async function(projectId) {
    editorHtml.value = ''; editorCss.value = ''; editorJs.value = '';
    
    if (projectId) {
        // Load from server logic (abbreviated)
        const project = projectsList.find(p => p.id === projectId);
        if(project) {
            currentProject = {...project};
            const [h, c, j] = await Promise.all([
                downloadStorageFile(BUCKET_NAME, project.htmlPath),
                downloadStorageFile(BUCKET_NAME, project.cssPath),
                downloadStorageFile(BUCKET_NAME, project.jsPath)
            ]);
            editorHtml.value = h; editorCss.value = c; editorJs.value = j;
        }
    } else {
        // Load LOCAL files
        currentProject.id = null;
        currentProject.name = 'New Upload';
        editorHtml.value = uploadedFilesMap.get('index.html') || '';
        editorCss.value = uploadedFilesMap.get('style.css') || '';
        editorJs.value = uploadedFilesMap.get('script.js') || '';
    }
    
    updatePreview();
    navigate('view-workspace', true);
}

window.updatePreview = function() {
    const blob = new Blob([`
        <!DOCTYPE html><html><head><style>${editorCss.value}</style></head>
        <body>${editorHtml.value}<script>${editorJs.value}<\/script></body></html>
    `], { type: 'text/html' });
    previewFrame.src = URL.createObjectURL(blob);
}
window.refreshPreview = window.updatePreview;

// --- STORAGE HELPERS ---
async function downloadStorageFile(bucket, path) {
    if(!path) return '';
    const { data } = await supabase.storage.from(bucket).download(path);
    return data ? await data.text() : '';
}

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
        const h = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/index.html`, currentProject.html || editorHtml.value, 'text/html');
        const c = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/style.css`, currentProject.css || editorCss.value, 'text/css');
        const j = await uploadProjectComponent(BUCKET_NAME, `${pathBase}/script.js`, currentProject.js || editorJs.value, 'application/javascript');
        
        await supabase.from('projects').insert([{ user_id: userId, name: name, html: h, css: c, js: j }]);
        alert('Project Saved!');
        resetUploadState();
    } catch(e) {
        alert('Save Failed: ' + e.message);
    }
}

function resetUploadState() {
    uploadedFilesMap.clear();
    validateProject();
    updateMiniList();
}

function switchEditorTab(tabId) {
    editorTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    [editorHtml, editorCss, editorJs].forEach(e => e.classList.toggle('active', e.id === `editor-${tabId}`));
}


