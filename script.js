// Supabase client is loaded via CDN link in index.html, so we can use `supabase.createClient` directly.

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbqOO8IGFwHdU'; 
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
let currentActiveTab = 'html'; // Added for editor state


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
const actionArea = document.getElementById('action-area');

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
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                handleAuthChange(session);
            } else if (event === 'SIGNED_OUT') {
                handleAuthChange(null);
            }
        });
        
        // 3. Immediately check the initial session status
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            handleAuthChange(session);
        } else {
            // No session found, show auth view
            handleAuthChange(null);
        }

    } catch (error) {
        console.error("Supabase initialization failed:", error.message);
        document.getElementById('loading-spinner').textContent = "❌ शुरू करने में विफल";
    }
}

// --- AUTH LOGIC ---

function handleAuthChange(session) {
    if (session) {
        userId = session.user.id;
        console.log("User logged in:", userId);
        loadProjects(); 
        
        const welcomeText = document.querySelector('#view-upload .toolbar-group span');
        welcomeText.textContent = `Welcome, ${session.user.email || session.user.id}!`;
        
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
    // ... (unchanged auth logic)
    if (setMode) {
        authMode = setMode;
    } else {
        authMode = authMode === 'login' ? 'signup' : 'login';
    }
    
    authTitle.textContent = authMode === 'login' ? 'प्रोजेक्ट्स एक्सेस करने के लिए लॉग इन करें' : 'नया अकाउंट बनाएँ';
    
    if (authMode === 'login') {
        loginBtn.style.display = 'flex';
        loginBtn.classList.add('btn-primary');
        loginBtn.classList.remove('btn-secondary');
        
        signupBtn.style.display = 'none';
        signupBtn.classList.remove('btn-primary');
        signupBtn.classList.add('btn-secondary');
    } else { // authMode === 'signup'
        signupBtn.style.display = 'flex';
        signupBtn.classList.add('btn-primary');
        signupBtn.classList.remove('btn-secondary');
        
        loginBtn.style.display = 'none';
        loginBtn.classList.remove('btn-primary');
        loginBtn.classList.add('btn-secondary');
    }
    
    modeToggleText.textContent = authMode === 'login' ? 'साइन अप' : 'लॉग इन';
    authMessage.style.display = 'none';
}

/**
 * Handles both Login and Signup actions based on the current authMode state.
 */
async function handleAuthAction() {
    // ... (unchanged auth logic)
    const actionType = authMode; // Read the current mode
    const email = authEmail.value;
    const password = authPassword.value;
    authMessage.style.display = 'none';
    
    if (!email || !password) {
        authMessage.textContent = 'ईमेल और पासवर्ड आवश्यक हैं।';
        authMessage.style.display = 'block';
        return;
    }

    let authPromise;
    if (actionType === 'login') {
        authPromise = supabase.auth.signInWithPassword({ email, password });
    } else if (actionType === 'signup') {
        // FIX: Added emailRedirectTo option to ensure the user is sent back to the app 
        // root after confirming the email, allowing the SDK to pick up the token.
        authPromise = supabase.auth.signUp({ 
            email, 
            password,
            options: {
                emailRedirectTo: window.location.origin, // Sends user back to root after confirmation
            }
        });
    }

    const { data, error } = await authPromise;

    if (error) {
        authMessage.textContent = `त्रुटि: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Auth Error:", error);
    } else if (actionType === 'signup' && !data.user) {
        authMessage.textContent = 'सफलतापूर्वक साइन अप किया गया! लॉग इन करने से पहले अपने अकाउंट की पुष्टि करने के लिए कृपया अपना ईमेल देखें।';
        authMessage.style.color = 'var(--success)';
        authMessage.style.display = 'block';
        toggleAuthMode('login'); // Switch back to login mode after successful signup prompt
    }
}

async function signInWithGoogle() {
    // ... (unchanged auth logic)
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin, 
        }
    });

    if (error) {
        authMessage.textContent = `Google साइन-इन त्रुटि: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Google Auth Error:", error);
    }
}

async function userSignOut() {
    // ... (unchanged auth logic)
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
    }
}

// --- STORAGE HELPER FUNCTIONS (NEW) ---

/**
 * Helper function to upload/update a single project component to Supabase Storage.
 * This is the core 'save to storage' logic.
 */
async function uploadProjectComponent(bucketName, filePath, content, mimeType) {
    if (!content) return null; 

    const fileContent = new Blob([content], { type: mimeType });

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileContent, {
            cacheControl: '3600',
            upsert: true // Allows updating existing files with the same path
        });

    if (error) {
        throw new Error(`Storage Upload Failed (${filePath}): ${error.message}`);
    }

    // data.path returns the path relative to the bucket (e.g., 'user_id/project_name/index.html')
    return data.path; 
}

/**
 * Helper function to download file content from Supabase Storage.
 * This is the core 'load from storage' logic.
 */
async function downloadStorageFile(bucketName, filePath) {
    if (!filePath) return '';
    
    const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);
        
    if (error) {
        console.warn(`Warning: Error downloading file ${filePath}. File might not exist.`, error.message);
        return `/* Error downloading content from Storage: ${error.message} */`;
    }

    // Convert Blob to text
    return await data.text();
}

/**
 * Constructs a temporary URL for the preview iframe using the code content.
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


// --- DATA / SUPABASE FUNCTIONS (UPDATED FOR STORAGE PATHS) ---

function loadProjects() {
    // ... (unchanged realtime setup logic)
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
    // --- UPDATED: 'html', 'css', 'js' columns now store paths, not content. ---
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at, html, css, js') 
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching projects. Check Supabase RLS policies for 'projects' table:", error);
        return;
    }

    // Store paths, not content
    projectsList = data.map(p => ({
        id: p.id,
        name: p.name,
        // Renamed properties locally to reflect they are paths
        htmlPath: p.html, 
        cssPath: p.css,   
        jsPath: p.js,     
        created_at: { toDate: () => new Date(p.created_at) } 
    }));
    
    renderProjectsList();
}


function renderProjectsList() {
    // ... (unchanged rendering logic)
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

// --- SAVE/UPLOAD LOGIC (UPDATED FOR STORAGE) ---

function saveProject() {
    if (!currentProject.html && !currentProject.css && !currentProject.js) { // Check for content, not paths here
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

/**
 * Saves project files to Storage and stores paths in the Database.
 */
async function confirmSaveProject() {
    const projectName = projectNameInput.value.trim();
    saveModalOverlay.style.display = 'none';

    if (!projectName) {
        console.log("Save cancelled: No project name provided.");
        return;
    }

    const projectPathBase = `${userId}/${projectName}`;
    
    try {
        // 1. Upload Files to Storage (The storage functionality the user requested)
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
        
        // 2. Save File Paths to Database (Replacing original content save)
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
        
        document.getElementById('file-count').textContent = `Project "${projectName}" सेव हो गया!`;
        
        resetUploadState(); 

    } catch (e) {
        console.error("Error saving document:", e.message);
        document.getElementById('file-count').textContent = `❌ सेव करने में विफल: ${e.message}`;
    }
}


/**
 * Updates files directly in Storage and updates the database record to ensure consistency.
 */
async function saveCodeChanges() {
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
        // 2. Update Files in Storage (The storage functionality the user requested)
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
        
        // 3. Update paths in the Database (in case any path was null previously)
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
        document.getElementById('editor-project-name').textContent = `${currentProject.name} (सेव हो गया!)`;
        setTimeout(() => {
            document.getElementById('editor-project-name').textContent = `एडिटिंग: ${currentProject.name}`;
        }, 2000);
        
    } catch (e) {
        console.error("Error saving changes:", e);
        document.getElementById('editor-project-name').textContent = `❌ सेव त्रुटि: ${e.message}`;
    }
}

// --- DELETE LOGIC (UPDATED FOR STORAGE DELETE) ---

function deleteProject(projectId, projectName) {
    // ... (unchanged modal setup)
    if (!userId) {
        console.error("User not authenticated.");
        return;
    }
    projectIdToDelete = projectId;
    deleteProjectNameDisplay.textContent = projectName;
    deleteModalOverlay.style.display = 'flex';
}

function cancelDelete() {
    // ... (unchanged modal tear down)
    projectIdToDelete = null;
    deleteModalOverlay.style.display = 'none';
}

async function confirmDelete() {
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
        // 1. Delete Files from Storage (The storage functionality the user requested)
        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove(filesToDelete);

            if (storageError) {
                // Warning: We log the error but still try to delete the DB record.
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

async function downloadProjectAsZip(projectId, projectName) {
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

    // --- UPDATED: Download content from Storage before zipping ---
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

// --- EDITOR / PREVIEW LOGIC (UPDATED FOR STORAGE DOWNLOAD) ---

/**
 * Loads project paths from ID, downloads content, and opens editor.
 */
async function openEditor(projectId) {
    switchView('view-workspace');
    editorHtml.value = '';
    editorCss.value = '';
    editorJs.value = '';
    editorProjectName.textContent = 'Loading...';
    
    // Clear paths when opening editor
    currentProject.htmlPath = null;
    currentProject.cssPath = null;
    currentProject.jsPath = null;


    if (projectId) {
        const project = projectsList.find(p => p.id === projectId);
        if (!project) return;
        
        // 1. Set paths/metadata
        currentProject = { 
            ...project, 
            html: '', css: '', js: '', // Clear content temporarily
            htmlPath: project.htmlPath,
            cssPath: project.cssPath,
            jsPath: project.jsPath
        };

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
        
        editorProjectName.textContent = `एडिटिंग: ${project.name}`;
        
    } else {
        // New upload/edit
        currentProject.name = 'New Upload';
        editorHtml.value = uploadedFilesMap.get('index.html') || '';
        editorCss.value = uploadedFilesMap.get('style.css') || '';
        editorJs.value = uploadedFilesMap.get('script.js') || '';
        editorProjectName.textContent = `एडिटिंग: New Upload`;
    }
    
    // Update preview after content is loaded/set
    switchEditorTab(currentActiveTab);
    updatePreview();
}

/**
 * Loads project paths from ID, downloads content, and opens fullscreen preview.
 */
async function launchProject(projectId) {
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
    previewProjectName.textContent = `फुलस्क्रीन: ${project.name}`;
}


function updatePreview() {
    // Get current content from the editor fields
    const htmlContent = editorHtml.value;
    const cssContent = editorCss.value;
    const jsContent = editorJs.value;

    previewFrame.src = getPreviewUrl(htmlContent, cssContent, jsContent);
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
    
    saveProjectBtn.disabled = !canSave;
    openEditorBtn.disabled = !canSave;
    
    const missingUl = missingList.querySelector('ul');
    missingUl.innerHTML = '';
    
    if (missing.length > 0) {
        missingList.style.display = 'block';
        missing.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file;
            missingUl.appendChild(li);
        });
    } else {
        missingList.style.display = 'none';
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

    fileCountDisplay.textContent = `${count} फ़ाइलें मिलीं।`;
}


window.addEventListener('load', () => {
    initSupabase();
    
    // --- Event Listeners ---
    folderInput.addEventListener('change', (e) => processFiles(e.target.files));
    fileInput.addEventListener('change', (e) => processFiles(e.target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    });
    dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-active'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-active');
        processFiles(e.dataTransfer.items);
    });

    editorTabs.forEach(tab => {
        tab.addEventListener('click', () => switchEditorTab(tab.dataset.tab));
    });
    
    projectNameInput.addEventListener('keydown', (e) => {
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

