// Supabase client is loaded via CDN link in index.html, so we can use `supabase.createClient` directly.

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
// ANCHOR: The confirmed key provided by the user (Used for initialization)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 
const BUCKET_NAME = 'ABC_assets'; // *** YOUR STORAGE BUCKET NAME ***


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
    // Paths are now stored in the database instead of content
    htmlPath: null, 
    cssPath: null,
    jsPath: null
};
let projectsList = []; 
let projectIdToDelete = null; 
let authMode = 'login'; // 'login' or 'signup'
let currentActiveTab = 'html'; 


// --- DOM Elements ---
// Ensure all DOM elements are correctly mapped here to avoid 'null' errors
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

// Auth Form Elements
const authTitle = document.getElementById('auth-title');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const modeToggleText = document.getElementById('mode-toggle-text');

// --- CORE FUNCTIONS (Helper for view switching, needed for other functions) ---

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
        if (view && view.id === viewId) {
            view.classList.add('active');
        } else if (view) {
            view.classList.remove('active');
        }
    });
}

// --- INITIALIZATION (FIXED LOGIC) ---

async function initSupabase() {
    try {
        // 1. Initialize Supabase Client
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // 2. Set up the Authentication Listener
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth State Change:', event);
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRFESHED') {
                handleAuthChange(session);
            } else if (event === 'SIGNED_OUT') {
                handleAuthChange(null);
            }
        });
        
        // 3. Immediately check the initial session status
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
             console.error("Error checking session:", error);
             document.getElementById('loading-spinner').textContent = "❌ Session check error.";
             return;
        }

        if (session) {
            handleAuthChange(session);
        } else {
            // No session found, show auth view
            handleAuthChange(null);
        }

    } catch (error) {
        console.error("Supabase initialization failed (CRITICAL):", error.message);
        document.getElementById('loading-spinner').textContent = "❌ Initialization failed.";
    }
}

// --- AUTH LOGIC ---

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        console.log("User logged in:", userId);
        loadProjects(); 
        
        const welcomeText = document.querySelector('#view-upload .toolbar-group span');
        if (welcomeText) {
            welcomeText.textContent = `Welcome, ${session.user.email || session.user.id}!`;
        }
        
        // Ensure the view switches to upload only after successful login/confirmation
        switchView('view-upload'); 
    } else {
        userId = null;
        console.log("User logged out or session expired.");
        // Ensure auth mode starts correctly when showing auth view
        toggleAuthMode('login'); 
        switchView('view-auth'); 
    }
}

function toggleAuthMode(setMode) {
    if (setMode) {
        authMode = setMode;
    } else {
        authMode = authMode === 'login' ? 'signup' : 'login';
    }
    
    authTitle.textContent = authMode === 'login' ? 'Log In to Access Projects' : 'Sign Up to Create Account';
    
    if (authMode === 'login') {
        if (loginBtn) loginBtn.style.display = 'flex';
        if (loginBtn) loginBtn.classList.add('btn-primary');
        if (loginBtn) loginBtn.classList.remove('btn-secondary');
        
        if (signupBtn) signupBtn.style.display = 'none';
        if (signupBtn) signupBtn.classList.remove('btn-primary');
        if (signupBtn) signupBtn.classList.add('btn-secondary');
    } else { // authMode === 'signup'
        if (signupBtn) signupBtn.style.display = 'flex';
        if (signupBtn) signupBtn.classList.add('btn-primary');
        if (signupBtn) signupBtn.classList.remove('btn-secondary');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (loginBtn) loginBtn.classList.remove('btn-primary');
        if (loginBtn) loginBtn.classList.add('btn-secondary');
    }
    
    if (modeToggleText) modeToggleText.textContent = authMode === 'login' ? 'Sign Up' : 'Log In';
    if (authMessage) authMessage.style.display = 'none';
}

/**
 * Handles both Login and Signup actions based on the current authMode state.
 * Attached to window object to be accessible from HTML onclick.
 */
window.handleAuthAction = async function() { 
    const actionType = authMode; 
    const email = authEmail.value;
    const password = authPassword.value;
    authMessage.style.display = 'none';
    
    if (!email || !password) {
        authMessage.textContent = 'Email and password are required.';
        authMessage.style.display = 'block';
        return;
    }

    let authPromise;
    if (actionType === 'login') {
        authMessage.textContent = 'Logging in...';
        authMessage.style.display = 'block';
        authPromise = supabase.auth.signInWithPassword({ email, password });
    } else if (actionType === 'signup') {
        authMessage.textContent = 'Signing up...';
        authMessage.style.display = 'block';
        authPromise = supabase.auth.signUp({ 
            email, 
            password,
            options: {
                emailRedirectTo: window.location.origin, 
            }
        });
    }

    const { data, error } = await authPromise;

    if (error) {
        // ERROR: If API key is invalid, the error will be caught here.
        authMessage.textContent = `Login Error: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Auth Error:", error);
    } else if (actionType === 'signup' && !data.user) {
        authMessage.textContent = 'Successfully signed up! Please check your email to confirm your account before logging in.';
        authMessage.style.color = 'var(--accent)';
        authMessage.style.display = 'block';
        toggleAuthMode('login'); 
    }
}

window.signInWithGoogle = async function() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin, 
        }
    });

    if (error) {
        authMessage.textContent = `Google Sign-in Error: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Google Auth Error:", error);
    }
}

window.userSignOut = async function() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
    }
}

// --- STORAGE HELPER FUNCTIONS (UNCHANGED) ---

async function uploadProjectComponent(bucketName, filePath, content, mimeType) {
    if (!content) return null; 

    const fileContent = new Blob([content], { type: mimeType });

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileContent, {
            cacheControl: '3600',
            upsert: true 
        });

    if (error) {
        throw new Error(`Storage Upload Failed (${filePath}): ${error.message}`);
    }

    return data.path; 
}

async function downloadStorageFile(bucketName, filePath) {
    if (!filePath) return '';
    
    const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);
        
    if (error) {
        console.warn(`Warning: Error downloading file ${filePath}. File might not exist.`, error.message);
        return `/* Error downloading content from Storage: ${error.message} */`;
    }

    return await data.text();
}

/**
 * Creates a local Blob URL for immediate preview (LOCAL FUNCTIONALITY)
 */
function getPreviewUrl(htmlContent, cssContent, jsContent) {
    const combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Preview</title>
            <style>${cssContent || ''}</style>
        </head>
        <body>
            ${htmlContent || ''}
            <script>${jsContent || ''}</script>
        </body>
        </html>
    `;
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
}


// --- DATA / SUPABASE FUNCTIONS ---

function loadProjects() {
    if (supabaseChannel) {
        supabaseChannel.unsubscribe();
    }
    
    // 1. Setup Realtime Channel
    supabaseChannel = supabase
        .channel(`projects_user_${userId}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, 
            (payload) => {
                console.log('Realtime change detected:', payload.eventType);
                fetchProjects(); 
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Realtime subscribed.');
            } else {
                console.log('Realtime subscription status:', status);
            }
        });

    // 2. Initial fetch: Call fetchProjects directly after setting up the listener
    fetchProjects(); 
}

async function fetchProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at, html, css, js') 
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching projects. Check Supabase RLS policies for 'projects' table:", error);
        return;
    }

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
        noProjectsMessage.style.display = 'block';
        return;
    }
    noProjectsMessage.style.display = 'none';

    projectsList.forEach(project => {
        const safeName = project.name.replace(/'/g, "\\'");
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${project.name || 'Untitled Project'}</h3>
            <p>बनाया गया: ${project.created_at.toDate().toLocaleDateString()}</p>
            <div class="project-actions">
                <button class="btn-base btn-primary" onclick="launchProject('${project.id}')">वेबसाइट देखें</button>
                <button class="btn-base btn-secondary" onclick="openEditor('${project.id}')">कोड एडिट करें</button>
                <button class="btn-base btn-secondary" onclick="downloadProjectAsZip('${project.id}', '${safeName}')" style="margin-top: 5px; background-color: #0d9488;">ज़िप डाउनलोड करें</button>
                <button class="btn-base btn-danger" onclick="deleteProject('${project.id}', '${safeName}')" style="margin-top: 10px; padding: 10px 15px;">डिलीट करें</button>
            </div>
        `;
        projectsListContainer.appendChild(card);
    });
}

// --- SAVE/UPLOAD LOGIC (Storage Logic runs ONLY here) ---

function saveProject() {
    if (!currentProject.html && !currentProject.css && !currentProject.js) { 
        console.error("Cannot save: Project content is empty.");
        return;
    }
    
    projectNameInput.value = currentProject.name === 'New Upload' ? '' : currentProject.name;
    saveModalOverlay.style.display = 'flex';
    projectNameInput.focus();
}

function cancelSave() {
    saveModalOverlay.style.display = 'none';
}

window.confirmSaveProject = async function() {
    const projectName = projectNameInput.value.trim();
    saveModalOverlay.style.display = 'none';

    if (!projectName) {
        console.log("Save cancelled: No project name provided.");
        return;
    }

    const projectPathBase = `${userId}/${projectName}`;
    
    try {
        // 1. Upload Files to Storage (THE ONLY PLACE INSERT/UPLOAD RUNS)
        const htmlPath = await uploadProjectComponent(
            BUCKET_NAME, 
            `${projectPathBase}/index.html`, 
            currentProject.html, 
            'text/html'
        );
        const cssPath = await uploadProjectComponent(
            BUCKET_NAME, 
            `${projectPathBase}/style.css`, 
            currentProject.css, 
            'text/css'
        );
        const jsPath = await uploadProjectComponent(
            BUCKET_NAME, 
            `${projectPathBase}/script.js`, 
            currentProject.js, 
            'application/javascript'
        );
        
        // 2. Save File Paths to Database
        const dataToSave = {
            user_id: userId,
            name: projectName,
            html: htmlPath, 
            css: cssPath,   
            js: jsPath     
        };

        const { data, error } = await supabase
            .from('projects')
            .insert([dataToSave])
            .select();

        if (error) throw error;

        // Update local state with new paths
        currentProject.id = data[0].id;
        currentProject.name = projectName;
        currentProject.htmlPath = htmlPath;
        currentProject.cssPath = cssPath;
        currentProject.jsPath = jsPath;
        
        document.getElementById('file-count').textContent = `Project "${projectName}" saved!`;
        
        resetUploadState(); 

    } catch (e) {
        console.error("Error saving document:", e.message);
        document.getElementById('file-count').textContent = `❌ Save Failed: ${e.message}`;
    }
}

window.saveCodeChanges = async function() {
    if (!currentProject.id) {
        console.error("Cannot save changes: Project ID is missing. Please save the project first.");
        return;
    }

    // 1. Get updated content from the editor
    const newHtml = editorHtml.value;
    const newCss = editorCss.value;
    const newJs = editorJs.value;
    
    const pathBase = `${userId}/${currentProject.name}`;

    try {
        // 2. Update Files in Storage (Storage Update Logic)
        const updatedHtmlPath = await uploadProjectComponent(
            BUCKET_NAME, 
            currentProject.htmlPath || `${pathBase}/index.html`, 
            newHtml, 
            'text/html'
        );
        const updatedCssPath = await uploadProjectComponent(
            BUCKET_NAME, 
            currentProject.cssPath || `${pathBase}/style.css`, 
            newCss, 
            'text/css'
        );
        const updatedJsPath = await uploadProjectComponent(
            BUCKET_NAME, 
            currentProject.jsPath || `${pathBase}/script.js`, 
            newJs, 
            'application/javascript'
        );
        
        // 3. Update paths in the Database
        const { error } = await supabase
            .from('projects')
            .update({
                html: updatedHtmlPath,
                css: updatedCssPath,
                js: updatedJsPath
            })
            .eq('id', currentProject.id)
            .eq('user_id', userId); 

        if (error) throw error;
        
        // 4. Update local state
        currentProject.html = newHtml;
        currentProject.css = newCss;
        currentProject.js = newJs;
        currentProject.htmlPath = updatedHtmlPath;
        currentProject.cssPath = updatedCssPath;
        currentProject.jsPath = updatedJsPath;

        // Update the local projects list
        const index = projectsList.findIndex(p => p.id === currentProject.id);
        if (index !== -1) {
            projectsList[index].htmlPath = updatedHtmlPath;
            projectsList[index].cssPath = updatedCssPath;
            projectsList[index].jsPath = updatedJsPath;
        }

        updatePreview(); // Update preview with new content

        console.log("Project changes saved successfully to Storage and DB:", currentProject.name);
        document.getElementById('editor-project-name').textContent = `${currentProject.name} (Saved!)`;
        setTimeout(() => {
            document.getElementById('editor-project-name').textContent = `Editing: ${currentProject.name}`;
        }, 2000);
        
    } catch (e) {
        console.error("Error saving changes:", e);
        document.getElementById('editor-project-name').textContent = `❌ Save Error: ${e.message}`;
    }
}

// --- DELETE LOGIC (UPDATED FOR STORAGE DELETE) ---

window.deleteProject = function(projectId, projectName) {
    if (!userId) {
        console.error("User not authenticated.");
        return;
    }
    projectIdToDelete = projectId;
    deleteProjectNameDisplay.textContent = projectName;
    deleteModalOverlay.style.display = 'flex';
}

window.cancelDelete = function() {
    projectIdToDelete = null;
    deleteModalOverlay.style.display = 'none';
}

window.confirmDelete = async function() {
    if (!projectIdToDelete) {
        cancelDelete();
        return;
    }
    
    deleteModalOverlay.style.display = 'none';
    const id = projectIdToDelete;
    projectIdToDelete = null;
    
    const project = projectsList.find(p => p.id === id);
    if (!project) {
        console.error("Project not found in local list.");
        return;
    }

    const filesToDelete = [project.htmlPath, project.cssPath, project.jsPath].filter(p => p);

    try {
        // 1. Delete Files from Storage 
        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove(filesToDelete);

            if (storageError) {
                console.error("Storage delete error:", storageError);
            } else {
                console.log("Associated files deleted from Storage.");
            }
        }

        // 2. Delete Record from Database
        const { error: dbError } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); 

        if (dbError) throw dbError;
        
        console.log(`Project ${id} deleted successfully.`);
    } catch (e) {
        console.error("Error deleting document:", e);
        console.error("Failed to delete project. Check console for details.");
    }
}

// --- DOWNLOAD LOGIC (JSZip - UPDATED FOR STORAGE DOWNLOAD) ---

window.downloadProjectAsZip = async function(projectId, projectName) {
    const project = projectsList.find(p => p.id === projectId);
    if (!project) {
        console.error("Project not found for download.");
        return;
    }

    if (typeof JSZip === 'undefined') {
        console.error("JSZip library is not loaded.");
        return;
    }

    const zip = new JSZip();

    // --- Download content from Storage before zipping ---
    const [htmlContent, cssContent, jsContent] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, project.htmlPath),
        downloadStorageFile(BUCKET_NAME, project.cssPath),
        downloadStorageFile(BUCKET_NAME, project.jsPath)
    ]);


    if (htmlContent && !htmlContent.startsWith('/* Error')) zip.file("index.html", htmlContent);
    if (cssContent && !cssContent.startsWith('/* Error')) zip.file("style.css", cssContent);
    if (jsContent && !jsContent.startsWith('/* Error')) zip.file("script.js", jsContent);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });

        const downloadLink = document.createElement("a");
        const downloadUrl = URL.createObjectURL(zipBlob);
        
        const safeFileName = projectName.replace(/[^a-z0-9\s]/gi, '_');

        downloadLink.href = downloadUrl;
        downloadLink.download = `${safeFileName}.zip`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click(); 
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
        
        console.log(`Project "${projectName}" downloaded as zip.`);
    } catch (e) {
        console.error("Error generating or downloading ZIP:", e);
    }
}

// --- EDITOR / PREVIEW LOGIC (Updated to pull content from local state first) ---

/**
 * Loads project paths from ID, downloads content, and opens editor.
 */
window.openEditor = async function(projectId) {
    switchView('view-editor'); // Switch to editor view first
    editorHtml.value = '';
    editorCss.value = '';
    editorJs.value = '';
    editorProjectName.textContent = 'Loading...';
    
    // Clear paths when opening editor
    currentProject.htmlPath = null;
    currentProject.cssPath = null;
    currentProject.jsPath = null;


    if (projectId) {
        // --- Existing Saved Project Logic (Requires Storage Download) ---
        const project = projectsList.find(p => p.id === projectId);
        if (!project) return;
        
        currentProject.name = project.name;
        currentProject.id = project.id;

        // 1. Set paths/metadata
        currentProject.htmlPath = project.htmlPath;
        currentProject.cssPath = project.cssPath;
        currentProject.jsPath = project.jsPath;

        editorProjectName.textContent = `Downloading: ${project.name}`;
        
        // 2. Download content from Storage using paths
        const [html, css, js] = await Promise.all([
            downloadStorageFile(BUCKET_NAME, project.htmlPath),
            downloadStorageFile(BUCKET_NAME, project.cssPath),
            downloadStorageFile(BUCKET_NAME, project.jsPath)
        ]);

        // 3. Populate state and editor
        currentProject.html = html;
        currentProject.css = css;
        currentProject.js = js;
        
        editorHtml.value = html;
        editorCss.value = css;
        editorJs.value = js;
        
        editorProjectName.textContent = `Editing: ${project.name}`;
        
    } else {
        // --- Local Upload Logic (Uses purely local state) ---
        currentProject.name = 'New Upload';
        currentProject.id = null;
        
        // Content comes directly from the uploadedFilesMap state
        editorHtml.value = uploadedFilesMap.get('index.html') || '';
        editorCss.value = uploadedFilesMap.get('style.css') || '';
        editorJs.value = uploadedFilesMap.get('script.js') || '';
        
        currentProject.html = editorHtml.value;
        currentProject.css = editorCss.value;
        currentProject.js = editorJs.value;
        
        editorProjectName.textContent = `Editing: New Upload`;
    }
    
    // Update preview after content is loaded/set
    switchEditorTab(currentActiveTab);
    updatePreview();
    switchView('view-workspace'); // Show the workspace which contains the editor
}

/**
 * Loads project paths from ID, downloads content, and opens fullscreen preview.
 */
window.launchProject = async function(projectId) {
    const project = projectsList.find(p => p.id === projectId);
    if (!project) return;

    previewProjectName.textContent = `Downloading: ${project.name}`;
    switchView('view-fullscreen');

    const [html, css, js] = await Promise.all([
        downloadStorageFile(BUCKET_NAME, project.htmlPath),
        downloadStorageFile(BUCKET_NAME, project.cssPath),
        downloadStorageFile(BUCKET_NAME, project.jsPath)
    ]);
    
    fullscreenFrame.src = getPreviewUrl(html, css, js);
    previewProjectName.textContent = `Project Preview: ${project.name}`;
}

/**
 * Refreshes the preview iframe using the current content in the editor.
 * (LOCAL PREVIEW FUNCTIONALITY)
 */
window.updatePreview = function() {
    // Get current content from the editor fields
    const htmlContent = editorHtml.value;
    const cssContent = editorCss.value;
    const jsContent = editorJs.value;

    previewFrame.src = getPreviewUrl(htmlContent, cssContent, jsContent);
}

// Re-exposed globally for HTML button call
window.refreshPreview = window.updatePreview;
window.toggleFullscreen = function(forceExit) {
    if (forceExit) {
        switchView('view-projects');
    } else {
        // This function needs definition, but using launchProject logic for now
        // Assuming the user meant a simple switch to fullscreen frame
        fullscreenFrame.src = previewFrame.src;
        switchView('view-fullscreen');
    }
}


function switchEditorTab(tabId) {
    currentActiveTab = tabId;
    editorTabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    [editorHtml, editorCss, editorJs].forEach(editor => {
        if (editor.dataset.tab === tabId) {
            editor.classList.add('active');
            editor.focus();
        } else {
            editor.classList.remove('active');
        }
    });
}


// --- UPLOAD / FILE HANDLING LOGIC ---

function resetUploadState() {
    uploadedFilesMap.clear();
    currentProject = { id: null, name: '', html: '', css: '', js: '', htmlPath: null, cssPath: null, jsPath: null };
    updateMiniList();
    validateProject();
}

function validateProject() {
    const hasHtml = !!uploadedFilesMap.get('index.html');
    
    currentProject.html = uploadedFilesMap.get('index.html') || '';
    currentProject.css = uploadedFilesMap.get('style.css') || '';
    currentProject.js = uploadedFilesMap.get('script.js') || '';

    let missing = [];
    if (!hasHtml) missing.push('index.html');
    
    const canSave = hasHtml;
    
    if (saveProjectBtn) saveProjectBtn.disabled = !canSave;
    if (openEditorBtn) openEditorBtn.disabled = !canSave;
    
    const missingUl = missingList ? missingList.querySelector('ul') : null;
    if (missingUl) missingUl.innerHTML = '';
    
    if (missing.length > 0) {
        if (missingList) missingList.style.display = 'block';
        missing.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file;
            if (missingUl) missingUl.appendChild(li);
        });
    } else {
        if (missingList) missingList.style.display = 'none';
    }
}

function updateMiniList() {
    miniFileList.innerHTML = '';
    const filesFound = uploadedFilesMap.keys();
    let count = 0;

    if (uploadedFilesMap.size > 0) {
        filesFound.forEach(filename => {
            const li = document.createElement('li');
            li.textContent = filename;
            miniFileList.appendChild(li);
            count++;
        });
    }

    fileCountDisplay.textContent = `${count} files found.`;
}


window.addEventListener('load', () => {
    initSupabase();
    
    // --- Event Listeners ---
    if (folderInput) folderInput.addEventListener('change', (e) => processFiles(e.target.files));
    if (fileInput) fileInput.addEventListener('change', (e) => processFiles(e.target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        if (dropZone) dropZone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    });
    if (dropZone) dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-active'));
    if (dropZone) dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    if (dropZone) dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-active');
        processFiles(e.dataTransfer.items);
    });

    editorTabs.forEach(tab => {
        tab.addEventListener('click', () => switchEditorTab(tab.dataset.tab));
    });
    
    if (projectNameInput) projectNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            confirmSaveProject();
        }
    });
});

async function processFiles(input) {
    try {
        let newFiles = [];
        
        if (input instanceof DataTransferItemList) {
            for (let i = 0; i < input.length; i++) {
                if (input[i].kind === 'file') {
                    const file = input[i].getAsFile();
                    if (file) newFiles.push(file);
                }
            }
        } else if (input) {
            newFiles = Array.from(input);
        }

        if (newFiles.length === 0) return;
        
        const readPromises = newFiles.map(file => {
            return new Promise((resolve) => {
                if (file.name.startsWith('.') || file.name === '.DS_Store') return resolve();

                // Handles nested paths for folder uploads
                const pathSegments = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [file.name];
                const filenameKey = pathSegments.pop().toLowerCase();
                
                if (filenameKey === 'index.html' || filenameKey === 'style.css' || filenameKey === 'script.js') {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        uploadedFilesMap.set(filenameKey, e.target.result);
                        resolve();
                    };
                    reader.onerror = () => resolve(); 
                    reader.readAsText(file);
                } else {
                    resolve(); 
                }
            });
        });

        await Promise.all(readPromises);
        
        currentProject.id = null;
        currentProject.name = 'New Upload';
        
        // Finalize the current project state from uploaded files
        validateProject();
        updateMiniList(); 

    } catch (e) {
        console.error("Error processing files:", e);
    }
}

