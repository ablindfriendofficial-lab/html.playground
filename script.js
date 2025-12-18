// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; 

let supabase = null;
let userId = null; 
let supabaseChannel = null; 

// --- APP STATE ---
let uploadedFilesMap = new Map(); 
let objectUrls = []; 
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
const errorDisplay = document.getElementById('error-display');
const missingList = document.getElementById('missing-list');
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

const authTitle = document.getElementById('auth-title');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const modeToggleText = document.getElementById('mode-toggle-text');

// --- CORE FUNCTIONS ---

function switchView(viewId) {
    const views = {
        'view-loading': viewLoading,
        'view-upload': viewUpload,
        'view-projects': viewProjects,
        'view-workspace': viewWorkspace,
        'view-fullscreen': viewFullscreen,
        'view-auth': viewAuth
    };
    
    Object.keys(views).forEach(key => {
        const view = views[key];
        if (view) {
            view.classList.toggle('active', key === viewId);
        }
    });
}

function navigate(viewId, pushState = true) {
    if (pushState && window.location.hash !== `#${viewId}`) {
        history.pushState({ viewId: viewId }, '', `#${viewId}`);
    }
    switchView(viewId);
}

window.addEventListener('popstate', (event) => {
    const viewId = event.state && event.state.viewId ? event.state.viewId : (userId ? 'view-upload' : 'view-auth');
    navigate(viewId, false);
});

// --- INITIALIZATION ---

async function initSupabase() {
    try {
        if (!window.supabase) {
            console.error("Supabase CDN not loaded.");
            document.getElementById('loading-spinner').textContent = "❌ Supabase library missing.";
            return;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth State Change:', event);
            handleAuthChange(session);
        });
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
             console.error("Error checking session:", error);
             document.getElementById('loading-spinner').textContent = "❌ Session check error.";
             return;
        }
        
        const initialHash = window.location.hash ? window.location.hash.substring(1) : (session ? 'view-upload' : 'view-auth');

        if (session) {
            handleAuthChange(session);
            navigate(initialHash, false); 
        } else {
            handleAuthChange(null);
            navigate('view-auth', false);
        }

    } catch (error) {
        console.error("Supabase initialization failed:", error.message);
        document.getElementById('loading-spinner').textContent = "❌ Initialization failed.";
    }
}

// --- AUTH LOGIC ---

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        loadProjects(); 
        const welcomeText = document.querySelector('#view-upload .toolbar-group span');
        if (welcomeText) {
            welcomeText.textContent = `Welcome, ${session.user.email || session.user.id}!`;
        }
        navigate('view-upload', true); 
    } else {
        userId = null;
        toggleAuthMode('login'); 
        navigate('view-auth', true); 
    }
}

window.toggleAuthMode = function(setMode) {
    if (setMode) {
        authMode = setMode;
    } else {
        authMode = authMode === 'login' ? 'signup' : 'login';
    }
    
    authTitle.textContent = authMode === 'login' ? 'Log In to Access Projects' : 'Sign Up to Create Account';
    
    if (authMode === 'login') {
        if (loginBtn) loginBtn.style.display = 'flex';
        if (signupBtn) signupBtn.style.display = 'none';
    } else {
        if (signupBtn) signupBtn.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
    }
    
    if (modeToggleText) modeToggleText.textContent = authMode === 'login' ? 'Sign Up' : 'Log In';
    if (authMessage) authMessage.style.display = 'none';
}

window.handleAuthAction = async function() { 
    const actionType = authMode; 
    const email = authEmail.value;
    const password = authPassword.value;
    
    if (!email || !password) {
        authMessage.textContent = 'Email and password are required.';
        authMessage.style.display = 'block';
        return;
    }

    let authPromise = actionType === 'login' 
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { data, error } = await authPromise;

    if (error) {
        authMessage.textContent = `Error: ${error.message}`;
        authMessage.style.display = 'block';
    } else if (actionType === 'signup' && !data.user) {
        authMessage.textContent = 'Check email to confirm account.';
        authMessage.style.display = 'block';
        toggleAuthMode('login'); 
    }
}

window.userSignOut = async function() {
    await supabase.auth.signOut();
}

// --- STORAGE HELPERS ---

async function uploadProjectComponent(bucketName, filePath, content, mimeType) {
    if (!content) return null; 
    const fileContent = new Blob([content], { type: mimeType });
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileContent, { cacheControl: '3600', upsert: true });

    if (error) throw new Error(`Upload Failed: ${error.message}`);
    return data.path; 
}

async function downloadStorageFile(bucketName, filePath) {
    if (!filePath) return '';
    const { data, error } = await supabase.storage.from(bucketName).download(filePath);
    if (error) return '';
    return await data.text();
}

function getPreviewUrl(htmlContent, cssContent, jsContent) {
    const combinedHtml = `<!DOCTYPE html><html><head><style>${cssContent || ''}</style></head><body>${htmlContent || ''}<script>${jsContent || ''}<\/script></body></html>`;
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
}

// --- DATA FUNCTIONS ---

function loadProjects() {
    if (supabaseChannel) supabaseChannel.unsubscribe();
    supabaseChannel = supabase
        .channel(`projects_user_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, fetchProjects)
        .subscribe();
    fetchProjects(); 
}

async function fetchProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at, html, css, js') 
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return console.error("Fetch Error:", error);

    projectsList = data.map(p => ({
        id: p.id,
        name: p.name,
        htmlPath: p.html, 
        cssPath: p.css,   
        jsPath: p.js,     
        created_at: { toDate: () => new Date(p.created_at) } 
    }));
    renderProjectsList();
}

function renderProjectsList() {
    projectsListContainer.innerHTML = '';
    if (projectsList.length === 0) {
        if (noProjectsMessage) noProjectsMessage.style.display = 'block';
        return;
    }
    if (noProjectsMessage) noProjectsMessage.style.display = 'none';

    projectsList.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${project.name || 'Untitled'}</h3>
            <p>बनाया गया: ${project.created_at.toDate().toLocaleDateString()}</p>
            <div class="project-actions">
                <button class="btn-base btn-primary" onclick="launchProject('${project.id}')">वेबसाइट देखें</button>
                <button class="btn-base btn-secondary" onclick="openEditor('${project.id}')">कोड एडिट करें</button>
                <button class="btn-base btn-secondary" onclick="downloadProjectAsZip('${project.id}', '${project.name}')">ज़िप डाउनलोड करें</button>
                <button class="btn-base btn-danger" onclick="deleteProject('${project.id}', '${project.name}')">डिलीट करें</button>
            </div>
        `;
        projectsListContainer.appendChild(card);
    });
}

// --- SAVE / UPLOAD ---

window.saveProject = () => {
    projectNameInput.value = currentProject.name === 'New Upload' ? '' : currentProject.name;
    saveModalOverlay.style.display = 'flex';
    projectNameInput.focus();
}

window.cancelSave = () => { saveModalOverlay.style.display = 'none'; }

window.confirmSaveProject = async function() {
    const projectName = projectNameInput.value.trim();
    saveModalOverlay.style.display = 'none';
    if (!projectName) return;

    const pathBase = `${userId}/${projectName}`;
    try {
        const [h, c, j] = await Promise.all([
            uploadProjectComponent(BUCKET_NAME, `${pathBase}/index.html`, uploadedFilesMap.get('index.html'), 'text/html'),
            uploadProjectComponent(BUCKET_NAME, `${pathBase}/style.css`, uploadedFilesMap.get('style.css'), 'text/css'),
            uploadProjectComponent(BUCKET_NAME, `${pathBase}/script.js`, uploadedFilesMap.get('script.js'), 'application/javascript')
        ]);
        
        const { error } = await supabase.from('projects').insert([{
            user_id: userId, name: projectName, html: h, css: c, js: j
        }]);
        if (error) throw error;
        resetUploadState(); 
        fetchProjects();
    } catch (e) {
        console.error("Save Error:", e.message);
    }
}

window.saveCodeChanges = async function() {
    if (!currentProject.id) return;
    const nH = editorHtml.value, nC = editorCss.value, nJ = editorJs.value;
    const base = `${userId}/${currentProject.name}`;

    try {
        const [h, c, j] = await Promise.all([
            uploadProjectComponent(BUCKET_NAME, currentProject.htmlPath || `${base}/index.html`, nH, 'text/html'),
            uploadProjectComponent(BUCKET_NAME, currentProject.cssPath || `${base}/style.css`, nC, 'text/css'),
            uploadProjectComponent(BUCKET_NAME, currentProject.jsPath || `${base}/script.js`, nJ, 'application/javascript')
        ]);
        
        await supabase.from('projects').update({ html: h, css: c, js: j }).eq('id', currentProject.id);
        currentProject.html = nH; currentProject.css = nC; currentProject.js = nJ;
        updatePreview();
    } catch (e) {
        console.error("Update Error:", e);
    }
}

// --- DELETE ---

window.deleteProject = (id, name) => {
    projectIdToDelete = id;
    deleteProjectNameDisplay.textContent = name;
    deleteModalOverlay.style.display = 'flex';
}

window.cancelDelete = () => {
    projectIdToDelete = null;
    deleteModalOverlay.style.display = 'none';
}

window.confirmDelete = async function() {
    if (!projectIdToDelete) return;
    const id = projectIdToDelete;
    cancelDelete();
    
    const project = projectsList.find(p => p.id === id);
    const files = [project.htmlPath, project.cssPath, project.jsPath].filter(p => p);

    try {
        if (files.length > 0) await supabase.storage.from(BUCKET_NAME).remove(files);
        await supabase.from('projects').delete().eq('id', id);
        fetchProjects();
    } catch (e) {
        console.error("Delete Error:", e);
    }
}

// --- ZIP DOWNLOAD ---

window.downloadProjectAsZip = async function(id, name) {
    const p = projectsList.find(x => x.id === id);
    if (typeof JSZip === 'undefined') return;
    const zip = new JSZip();
    const [h, c, j] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, p.htmlPath),
        downloadStorageFile(BUCKET_NAME, p.cssPath),
        downloadStorageFile(BUCKET_NAME, p.jsPath)
    ]);
    if (h) zip.file("index.html", h);
    if (c) zip.file("style.css", c);
    if (j) zip.file("script.js", j);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.zip`;
    a.click();
}

// --- EDITOR & PREVIEW ---

window.openEditor = async function(id) {
    editorHtml.value = ''; editorCss.value = ''; editorJs.value = '';
    if (id) {
        const p = projectsList.find(x => x.id === id);
        currentProject = { ...p };
        editorProjectName.textContent = "Downloading...";
        const [h, c, j] = await Promise.all([
            downloadStorageFile(BUCKET_NAME, p.htmlPath),
            downloadStorageFile(BUCKET_NAME, p.cssPath),
            downloadStorageFile(BUCKET_NAME, p.jsPath)
        ]);
        currentProject.html = h; currentProject.css = c; currentProject.js = j;
        editorHtml.value = h; editorCss.value = c; editorJs.value = j;
        editorProjectName.textContent = `Editing: ${p.name}`;
    } else {
        currentProject.name = 'New Upload'; currentProject.id = null;
        editorHtml.value = uploadedFilesMap.get('index.html') || '';
        editorCss.value = uploadedFilesMap.get('style.css') || '';
        editorJs.value = uploadedFilesMap.get('script.js') || '';
        editorProjectName.textContent = `Editing: New Upload`;
    }
    updatePreview();
    navigate('view-workspace', true); 
}

window.launchProject = async function(id) {
    const p = projectsList.find(x => x.id === id);
    previewProjectName.textContent = "Loading...";
    const [h, c, j] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, p.htmlPath),
        downloadStorageFile(BUCKET_NAME, p.cssPath),
        downloadStorageFile(BUCKET_NAME, p.jsPath)
    ]);
    fullscreenFrame.src = getPreviewUrl(h, c, j);
    previewProjectName.textContent = p.name;
    navigate('view-fullscreen', true); 
}

window.updatePreview = () => {
    previewFrame.src = getPreviewUrl(editorHtml.value, editorCss.value, editorJs.value);
}

window.refreshPreview = window.updatePreview;

function switchEditorTab(tabId) {
    currentActiveTab = tabId;
    editorTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    [editorHtml, editorCss, editorJs].forEach(ed => ed.classList.toggle('active', ed.dataset.tab === tabId));
}

// --- FILE HANDLING ---

function resetUploadState() {
    uploadedFilesMap.clear();
    currentProject = { id: null, name: '', html: '', css: '', js: '', htmlPath: null, cssPath: null, jsPath: null };
    updateMiniList();
    validateProject();
}

function validateProject() {
    const hasHtml = !!uploadedFilesMap.get('index.html');
    if (saveProjectBtn) saveProjectBtn.disabled = !hasHtml;
    if (openEditorBtn) openEditorBtn.disabled = !hasHtml;
    if (missingList) missingList.style.display = hasHtml ? 'none' : 'block';
}

function updateMiniList() {
    miniFileList.innerHTML = '';
    uploadedFilesMap.forEach((v, k) => {
        const li = document.createElement('li'); li.textContent = k; miniFileList.appendChild(li);
    });
    fileCountDisplay.textContent = `${uploadedFilesMap.size} files ready.`;
}

async function processFiles(input) {
    let files = input instanceof DataTransferItemList 
        ? Array.from(input).filter(i => i.kind === 'file').map(i => i.getAsFile())
        : Array.from(input);

    for (let file of files) {
        if (!file || file.name.startsWith('.')) continue;
        const name = file.name.toLowerCase();
        let key = name.endsWith('.html') ? 'index.html' : name.endsWith('.css') ? 'style.css' : name.endsWith('.js') ? 'script.js' : null;
        if (key) uploadedFilesMap.set(key, await file.text());
    }
    validateProject();
    updateMiniList(); 
}

window.addEventListener('load', () => {
    initSupabase();
    if (folderInput) folderInput.onchange = e => processFiles(e.target.files);
    if (fileInput) fileInput.onchange = e => processFiles(e.target.files);
    if (dropZone) {
        dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('drag-active'); };
        dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
        dropZone.ondrop = e => { e.preventDefault(); dropZone.classList.remove('drag-active'); processFiles(e.dataTransfer.items); };
    }
    editorTabs.forEach(t => t.onclick = () => switchEditorTab(t.dataset.tab));
});

