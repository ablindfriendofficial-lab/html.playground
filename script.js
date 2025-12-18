// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; 

let supabase = null;
let userId = null; 
let supabaseChannel = null; 

// --- APP STATE ---
let uploadedFilesMap = new Map(); 
let currentProject = {
    id: null,
    name: '',
    html: '',
    css: '',
    js: '',
    htmlPath: null, 
    cssPath: null,
    jsPath: null
};
let projectsList = []; 
let projectIdToDelete = null; 
let authMode = 'login'; 
let currentActiveTab = 'html'; 

// --- DOM Elements ---
// We use a helper to prevent 'null' reference errors if an ID is missing in HTML
const get = (id) => document.getElementById(id);

const viewLoading = get('view-loading');
const viewUpload = get('view-upload');
const viewProjects = get('view-projects');
const viewWorkspace = get('view-workspace');
const viewFullscreen = get('view-fullscreen');
const viewAuth = get('view-auth');

const dropZone = get('drop-zone');
const fileInput = get('file-input');
const folderInput = get('folder-input');
const miniFileList = get('mini-file-list');
const fileCountDisplay = get('file-count');
const saveProjectBtn = get('save-project-btn'); 
const openEditorBtn = get('open-editor-btn'); 

const projectsListContainer = get('projects-list');
const noProjectsMessage = get('no-projects-message');
const previewFrame = get('preview-frame');
const fullscreenFrame = get('fullscreen-frame');
const previewProjectName = get('preview-project-name');

const editorHtml = get('editor-html');
const editorCss = get('editor-css');
const editorJs = get('editor-js');
const editorProjectName = get('editor-project-name');
const editorTabs = document.querySelectorAll('.editor-tab');

const saveModalOverlay = get('save-modal-overlay');
const projectNameInput = get('project-name-input');
const deleteModalOverlay = get('delete-modal-overlay');
const deleteProjectNameDisplay = get('delete-project-name');

const authTitle = get('auth-title');
const authEmail = get('auth-email');
const authPassword = get('auth-password');
const authMessage = get('auth-message');
const loginBtn = get('login-btn');
const signupBtn = get('signup-btn');
const modeToggleText = get('mode-toggle-text');

// --- CORE FUNCTIONS ---

function switchView(viewId) {
    const allViews = [viewLoading, viewUpload, viewProjects, viewWorkspace, viewFullscreen, viewAuth];
    allViews.forEach(v => {
        if (v) v.classList.toggle('active', v.id === viewId);
    });
}

function navigate(viewId, pushState = true) {
    if (pushState && window.location.hash !== `#${viewId}`) {
        history.pushState({ viewId }, '', `#${viewId}`);
    }
    switchView(viewId);
}

window.addEventListener('popstate', (event) => {
    const viewId = event.state?.viewId || (userId ? 'view-upload' : 'view-auth');
    navigate(viewId, false);
});

// --- INITIALIZATION ---

async function initSupabase() {
    try {
        if (!window.supabase) throw new Error("Supabase library missing");

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            handleAuthChange(session);
        });
        
        // Check current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            handleAuthChange(session);
        } else {
            navigate('view-auth');
        }

    } catch (error) {
        console.error("Initialization error:", error);
        const spinner = get('loading-spinner');
        if (spinner) spinner.textContent = "❌ Initialization failed.";
        // Fallback to auth if something goes wrong
        setTimeout(() => navigate('view-auth'), 1000);
    }
}

// --- AUTH LOGIC ---

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        loadProjects(); 
        const welcomeSpan = document.querySelector('#view-upload .toolbar-group span');
        if (welcomeSpan) welcomeSpan.textContent = `Welcome, ${session.user.email}!`;
        navigate('view-upload'); 
    } else {
        userId = null;
        navigate('view-auth'); 
    }
}

window.toggleAuthMode = function() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    if (authTitle) authTitle.textContent = authMode === 'login' ? 'Log In' : 'Sign Up';
    if (loginBtn) loginBtn.style.display = authMode === 'login' ? 'flex' : 'none';
    if (signupBtn) signupBtn.style.display = authMode === 'signup' ? 'flex' : 'none';
    if (modeToggleText) modeToggleText.textContent = authMode === 'login' ? 'Sign Up' : 'Log In';
};

window.handleAuthAction = async function() { 
    const email = authEmail?.value;
    const password = authPassword?.value;
    if (!email || !password) return;

    const { error } = authMode === 'login' 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
        if (authMessage) {
            authMessage.textContent = error.message;
            authMessage.style.display = 'block';
        }
    }
};

window.userSignOut = () => supabase.auth.signOut();

// --- STORAGE & ZIP LOGIC ---

async function uploadProjectComponent(bucket, path, content, type) {
    if (!content) return null; 
    const { data, error } = await supabase.storage.from(bucket).upload(path, new Blob([content], { type }), { upsert: true });
    if (error) throw error;
    return data.path; 
}

async function downloadStorageFile(bucket, path) {
    if (!path) return '';
    const { data, error } = await supabase.storage.from(bucket).download(path);
    return error ? '' : await data.text();
}

window.downloadProjectAsZip = async function(projectId, projectName) {
    const project = projectsList.find(p => p.id === projectId);
    if (!project || typeof JSZip === 'undefined') return;

    const zip = new JSZip();
    const [h, c, j] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, project.htmlPath),
        downloadStorageFile(BUCKET_NAME, project.cssPath),
        downloadStorageFile(BUCKET_NAME, project.jsPath)
    ]);

    if (h) zip.file("index.html", h);
    if (c) zip.file("style.css", c);
    if (j) zip.file("script.js", j);

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/ /g, '_')}.zip`;
    link.click();
};

// --- DATA LOGIC ---

function loadProjects() {
    if (supabaseChannel) supabaseChannel.unsubscribe();
    supabaseChannel = supabase
        .channel(`projects_user_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, fetchProjects)
        .subscribe();
    fetchProjects(); 
}

async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return;

    projectsList = data.map(p => ({
        id: p.id, name: p.name, htmlPath: p.html, cssPath: p.css, jsPath: p.js,
        created_at: { toDate: () => new Date(p.created_at) } 
    }));
    renderProjectsList();
}

function renderProjectsList() {
    if (!projectsListContainer) return;
    projectsListContainer.innerHTML = '';
    if (projectsList.length === 0) {
        if (noProjectsMessage) noProjectsMessage.style.display = 'block';
        return;
    }
    if (noProjectsMessage) noProjectsMessage.style.display = 'none';

    projectsList.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${p.name}</h3>
            <p>बनाया गया: ${p.created_at.toDate().toLocaleDateString()}</p>
            <div class="project-actions">
                <button class="btn-base btn-primary" onclick="launchProject('${p.id}')">वेबसाइट देखें</button>
                <button class="btn-base btn-secondary" onclick="openEditor('${p.id}')">कोड एडिट करें</button>
                <button class="btn-base btn-secondary" onclick="downloadProjectAsZip('${p.id}', '${p.name}')">ज़िप डाउनलोड करें</button>
                <button class="btn-base btn-danger" onclick="deleteProject('${p.id}', '${p.name}')">डिलीट करें</button>
            </div>
        `;
        projectsListContainer.appendChild(card);
    });
}

// --- SAVE & EDIT ---

window.saveProject = () => {
    if (projectNameInput) projectNameInput.value = '';
    if (saveModalOverlay) saveModalOverlay.style.display = 'flex';
};

window.cancelSave = () => { if (saveModalOverlay) saveModalOverlay.style.display = 'none'; };

window.confirmSaveProject = async function() {
    const name = projectNameInput?.value.trim();
    if (!name) return;
    if (saveModalOverlay) saveModalOverlay.style.display = 'none';

    try {
        const base = `${userId}/${name}`;
        const [h, c, j] = await Promise.all([
            uploadProjectComponent(BUCKET_NAME, `${base}/index.html`, uploadedFilesMap.get('index.html'), 'text/html'),
            uploadProjectComponent(BUCKET_NAME, `${base}/style.css`, uploadedFilesMap.get('style.css'), 'text/css'),
            uploadProjectComponent(BUCKET_NAME, `${base}/script.js`, uploadedFilesMap.get('script.js'), 'application/javascript')
        ]);

        await supabase.from('projects').insert([{ user_id: userId, name, html: h, css: c, js: j }]);
        resetUploadState();
    } catch (e) { console.error(e); }
};

window.saveCodeChanges = async function() {
    if (!currentProject.id) return;
    const base = `${userId}/${currentProject.name}`;
    try {
        const [h, c, j] = await Promise.all([
            uploadProjectComponent(BUCKET_NAME, currentProject.htmlPath || `${base}/index.html`, editorHtml.value, 'text/html'),
            uploadProjectComponent(BUCKET_NAME, currentProject.cssPath || `${base}/style.css`, editorCss.value, 'text/css'),
            uploadProjectComponent(BUCKET_NAME, currentProject.jsPath || `${base}/script.js`, editorJs.value, 'application/javascript')
        ]);
        await supabase.from('projects').update({ html: h, css: c, js: j }).eq('id', currentProject.id);
        alert("Changes Saved!");
    } catch (e) { alert("Error: " + e.message); }
};

// --- EDITOR & PREVIEW ---

window.openEditor = async function(id) {
    navigate('view-workspace');
    if (id) {
        const p = projectsList.find(x => x.id === id);
        currentProject = { ...p };
        if (editorProjectName) editorProjectName.textContent = "Loading...";
        const [h, c, j] = await Promise.all([
            downloadStorageFile(BUCKET_NAME, p.htmlPath),
            downloadStorageFile(BUCKET_NAME, p.cssPath),
            downloadStorageFile(BUCKET_NAME, p.jsPath)
        ]);
        if (editorHtml) editorHtml.value = h;
        if (editorCss) editorCss.value = c;
        if (editorJs) editorJs.value = j;
        if (editorProjectName) editorProjectName.textContent = `Editing: ${p.name}`;
    } else {
        if (editorHtml) editorHtml.value = uploadedFilesMap.get('index.html') || '';
        if (editorCss) editorCss.value = uploadedFilesMap.get('style.css') || '';
        if (editorJs) editorJs.value = uploadedFilesMap.get('script.js') || '';
        if (editorProjectName) editorProjectName.textContent = "New Upload";
    }
    updatePreview();
};

window.updatePreview = function() {
    if (!previewFrame) return;
    const content = `<html><head><style>${editorCss?.value || ''}</style></head><body>${editorHtml?.value || ''}<script>${editorJs?.value || ''}<\/script></body></html>`;
    previewFrame.srcdoc = content;
};

window.launchProject = async function(id) {
    const p = projectsList.find(x => x.id === id);
    navigate('view-fullscreen');
    if (previewProjectName) previewProjectName.textContent = "Loading...";
    const [h, c, j] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, p.htmlPath),
        downloadStorageFile(BUCKET_NAME, p.cssPath),
        downloadStorageFile(BUCKET_NAME, p.jsPath)
    ]);
    if (fullscreenFrame) fullscreenFrame.srcdoc = `<html><head><style>${c}</style></head><body>${h}<script>${j}<\/script></body></html>`;
    if (previewProjectName) previewProjectName.textContent = p.name;
};

// --- DELETE ---

window.deleteProject = (id, name) => {
    projectIdToDelete = id;
    if (deleteProjectNameDisplay) deleteProjectNameDisplay.textContent = name;
    if (deleteModalOverlay) deleteModalOverlay.style.display = 'flex';
};

window.cancelDelete = () => { if (deleteModalOverlay) deleteModalOverlay.style.display = 'none'; };

window.confirmDelete = async function() {
    const id = projectIdToDelete;
    if (deleteModalOverlay) deleteModalOverlay.style.display = 'none';
    const p = projectsList.find(x => x.id === id);
    const files = [p.htmlPath, p.cssPath, p.jsPath].filter(f => f);
    
    await supabase.storage.from(BUCKET_NAME).remove(files);
    await supabase.from('projects').delete().eq('id', id);
    fetchProjects();
};

// --- FILE HANDLING ---

async function processFiles(input) {
    let files = input instanceof DataTransferItemList 
        ? Array.from(input).filter(i => i.kind === 'file').map(i => i.getAsFile())
        : Array.from(input);

    for (let f of files) {
        if (!f || f.name.startsWith('.')) continue;
        const n = f.name.toLowerCase();
        let key = n.endsWith('.html') ? 'index.html' : n.endsWith('.css') ? 'style.css' : n.endsWith('.js') ? 'script.js' : null;
        if (key) uploadedFilesMap.set(key, await f.text());
    }
    updateMiniList();
}

function updateMiniList() {
    if (miniFileList) {
        miniFileList.innerHTML = '';
        uploadedFilesMap.forEach((v, k) => {
            const li = document.createElement('li'); li.textContent = k; miniFileList.appendChild(li);
        });
    }
    if (fileCountDisplay) fileCountDisplay.textContent = `${uploadedFilesMap.size} files found.`;
    if (saveProjectBtn) saveProjectBtn.disabled = !uploadedFilesMap.has('index.html');
}

function resetUploadState() {
    uploadedFilesMap.clear();
    updateMiniList();
}

window.switchView = (id) => navigate(id);

// --- START ---

window.onload = () => {
    initSupabase();
    if (fileInput) fileInput.onchange = (e) => processFiles(e.target.files);
    if (folderInput) folderInput.onchange = (e) => processFiles(e.target.files);
    if (dropZone) {
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); };
        dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
        dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); processFiles(e.dataTransfer.items); };
    }
    editorTabs.forEach(t => t.onclick = () => {
        editorTabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const tab = t.dataset.tab;
        [editorHtml, editorCss, editorJs].forEach(ed => {
            if (ed) ed.classList.toggle('active', ed.dataset.tab === tab);
        });
    });
};