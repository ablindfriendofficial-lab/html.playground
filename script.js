// Supabase client is loaded via CDN link in index.html, so we can use `supabase.createClient` directly.

// --- SUPABASE CONFIGURATION ---
// इस कोड को इस्तेमाल करने के लिए आपको कोई Environment Variable सेट नहीं करना है।
// (No Environment Variables needed for this file.)

// 1. Project URL (आपके द्वारा दिया गया मान)
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';

// 2. Anon Public Key (आपके द्वारा दिया गया मान)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGZndG1xcHNsbWl5d3lvd3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDA4NjgsImV4cCI6MjA4MTExNjg2OH0.o1YimirJA75cFLe4OTeNzX8gU1LPwJRbQOO8IGFwHdU'; 


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
    js: ''
};
let projectsList = []; 
let projectIdToDelete = null; 
let authMode = 'login'; // 'login' or 'signup'

// --- DOM Elements ---
const viewLoading = document.getElementById('view-loading');
const viewUpload = document.getElementById('view-upload');
const viewProjects = document.getElementById('view-projects');
const viewWorkspace = document.getElementById('view-workspace');
const viewFullscreen = document.getElementById('view-fullscreen');
const viewEditor = document.getElementById('view-editor');
const viewAuth = document.getElementById('view-auth'); // New Auth View

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


// --- INITIALIZATION ---

async function initSupabase() {
    try {
        // 1. Initialize Supabase Client with hardcoded keys
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // 2. Set up the Authentication Listener
        supabase.auth.onAuthStateChange((event, session) => {
            handleAuthChange(session);
        });
        
        // 3. Check the initial session status (which triggers the first onAuthStateChange)
        const { data: { session } } = await supabase.auth.getSession();
        handleAuthChange(session); // Handle initial state

    } catch (error) {
        console.error("Supabase initialization failed:", error.message);
        document.getElementById('loading-spinner').textContent = "❌ Init Failed";
    }
}

// --- AUTH LOGIC ---

function handleAuthChange(session) {
    if (session) {
        // User is logged in
        userId = session.user.id;
        console.log("User logged in:", userId);
        loadProjects(); // Load data for the authenticated user
        
        // Update welcome message
        const welcomeText = document.querySelector('#view-upload .toolbar-group span');
        welcomeText.textContent = `Welcome, ${session.user.email || session.user.id}!`;
        
        switchView('view-upload'); // Show the main application view
    } else {
        // User is logged out
        userId = null;
        console.log("User logged out or session expired.");
        switchView('view-auth'); // Show the login/signup screen
    }
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    authTitle.textContent = authMode === 'login' ? 'Log In to Access Projects' : 'Create New Account';
    loginBtn.style.display = authMode === 'login' ? 'flex' : 'none';
    signupBtn.style.display = authMode === 'signup' ? 'flex' : 'none';
    modeToggleText.textContent = authMode === 'login' ? 'Sign Up' : 'Log In';
    authMessage.style.display = 'none';
}

/**
 * Handles both Login and Signup actions based on the current authMode state.
 */
async function handleAuthAction() {
    const actionType = authMode; // Read the current mode
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
        authPromise = supabase.auth.signInWithPassword({ email, password });
    } else if (actionType === 'signup') {
        // FIX: The user needs to enable Email/Password provider in Supabase Auth settings.
        authPromise = supabase.auth.signUp({ email, password });
    }

    const { data, error } = await authPromise;

    if (error) {
        authMessage.textContent = `Error: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Auth Error:", error);
    } else if (actionType === 'signup' && !data.user) {
        // Supabase sends a confirmation email, but user is not immediately logged in
        authMessage.textContent = 'Successfully signed up! Please check your email to confirm your account before logging in.';
        authMessage.style.color = 'var(--success)';
        authMessage.style.display = 'block';
        toggleAuthMode(); // Switch back to login
    }
    // If login is successful, onAuthStateChange listener handles the switch to 'view-upload'
}

async function signInWithGoogle() {
    // Redirects the user to the Google sign-in page
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // Optional: Redirect the user back to the current page after login
            redirectTo: window.location.origin, 
        }
    });

    if (error) {
        authMessage.textContent = `Google Sign-in Error: ${error.message}`;
        authMessage.style.display = 'block';
        console.error("Google Auth Error:", error);
    }
    // If successful, Supabase handles the redirection, and onAuthStateChange handles the state change upon return.
}

async function userSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
    }
    // onAuthStateChange listener handles the switch to 'view-auth'
}

// --- DATA / SUPABASE FUNCTIONS ---

function loadProjects() {
    if (supabaseChannel) {
        supabaseChannel.unsubscribe();
    }
    
    // 1. Setup Realtime Channel
    supabaseChannel = supabase
        .channel(`projects_user_${userId}`) // Channel name tied to user ID
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, 
            (payload) => {
                // Realtime events triggered, refetch all data to update projectsList
                console.log('Realtime change detected:', payload.eventType);
                fetchProjects(); 
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Realtime subscribed. Initial fetch...');
                fetchProjects(); 
            } else {
                 console.log('Realtime subscription status:', status);
            }
        });
}

async function fetchProjects() {
    // Select all columns from 'projects' where user_id matches the current user
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        // This likely means RLS policy is wrong or the user is not authenticated.
        console.error("Error fetching projects. Check Supabase RLS policies for 'projects' table:", error);
        return;
    }

    projectsList = data.map(p => ({
        id: p.id,
        name: p.name,
        html: p.html,
        css: p.css,
        js: p.js,
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
            <p>Created: ${project.created_at ? project.created_at.toDate().toLocaleDateString() : 'Unknown'}</p>
            <div class="project-actions">
                <button class="btn-base btn-primary" onclick="launchProject('${project.id}')">View Website</button>
                <button class="btn-base btn-secondary" onclick="openEditor('${project.id}')">Edit Code</button>
                <button class="btn-base btn-secondary" onclick="downloadProjectAsZip('${project.id}', '${safeName}')" style="margin-top: 5px; background-color: #0d9488;">Download Zip</button>
                <button class="btn-base btn-danger" onclick="deleteProject('${project.id}', '${safeName}')" style="margin-top: 10px; padding: 10px 15px;">Delete</button>
            </div>
        `;
        projectsListContainer.appendChild(card);
    });
}

// --- SAVE/UPLOAD LOGIC (Uses authenticated user ID) ---

function saveProject() {
    if (!currentProject.html || !currentProject.css || !currentProject.js) {
        console.error("Cannot save: Missing project content. Please ensure all three files are uploaded.");
        return;
    }
    
    projectNameInput.value = currentProject.name === 'New Upload' ? '' : currentProject.name;
    saveModalOverlay.style.display = 'flex';
    projectNameInput.focus();
}

function cancelSave() {
    saveModalOverlay.style.display = 'none';
}

async function confirmSaveProject() {
    const projectName = projectNameInput.value.trim();
    saveModalOverlay.style.display = 'none';

    if (!projectName) {
        console.log("Save cancelled: No project name provided.");
        return;
    }

    try {
        const dataToSave = {
            user_id: userId, // CRUCIAL: Links project to the logged-in user
            name: projectName,
            html: currentProject.html,
            css: currentProject.css,
            js: currentProject.js
        };

        const { data, error } = await supabase
            .from('projects')
            .insert([dataToSave])
            .select();

        if (error) throw error;

        currentProject.id = data[0].id;
        currentProject.name = projectName;
        console.log("Project saved with ID:", currentProject.id);
        
        document.getElementById('file-count').textContent = `Project "${projectName}" saved!`;
        
        resetUploadState(); 

    } catch (e) {
        console.error("Error saving document:", e);
        console.error("Failed to save project to Supabase. Check console for details.");
    }
}


async function saveCodeChanges() {
    if (!currentProject.id) {
        console.error("Cannot save changes: Project ID is missing. Please save the project first.");
        return;
    }

    currentProject.html = editorHtml.value;
    currentProject.css = editorCss.value;
    currentProject.js = editorJs.value;

    try {
        const { error } = await supabase
            .from('projects')
            .update({
                html: currentProject.html,
                css: currentProject.css,
                js: currentProject.js
            })
            .eq('id', currentProject.id)
            .eq('user_id', userId); // Ensure only the current user can update

        if (error) throw error;

        const index = projectsList.findIndex(p => p.id === currentProject.id);
        if (index !== -1) {
            projectsList[index].html = currentProject.html;
            projectsList[index].css = currentProject.css;
            projectsList[index].js = currentProject.js;
        }

        console.log("Project changes saved successfully for:", currentProject.name);
        document.getElementById('editor-project-name').textContent = `${currentProject.name} (Saved!)`;
        setTimeout(() => {
            document.getElementById('editor-project-name').textContent = `Editing: ${currentProject.name}`;
        }, 2000);
        
    } catch (e) {
        console.error("Error saving changes:", e);
        window.alert("Error saving code changes. Check console for details.");
    }
}

function resetUploadState() {
    uploadedFilesMap.clear();
    currentProject = { id: null, name: '', html: '', css: '', js: '' };
    updateMiniList();
    validateProject();
}

// --- DELETE LOGIC ---

function deleteProject(projectId, projectName) {
    if (!userId) {
        console.error("User not authenticated.");
        return;
    }
    projectIdToDelete = projectId;
    deleteProjectNameDisplay.textContent = projectName;
    deleteModalOverlay.style.display = 'flex';
}

function cancelDelete() {
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

    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Ensure RLS is respected

        if (error) throw error;
        
        console.log(`Project ${id} deleted successfully.`);
    } catch (e) {
        console.error("Error deleting document:", e);
        console.error("Failed to delete project. Check console for details.");
    }
}

// --- DOWNLOAD LOGIC (JSZip) ---

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

    if (project.html) zip.file("index.html", project.html);
    if (project.css) zip.file("style.css", project.css);
    if (project.js) zip.file("script.js", project.js);

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


// --- UPLOAD / FILE HANDLING LOGIC (Rest of the logic remains the same) ---

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
    dropZone.addEventListener('drop', (e) => processFiles(e.dataTransfer.items));

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
                const entry = input[i].webkitGetAsEntry ? input[i].webkitGetAsEntry() : null;
                if (entry && entry.isFile) newFiles.push(input[i].getAsFile());
                if (!entry) { 
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

                const filenameKey = file.name.toLowerCase().split('/').pop();

                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedFilesMap.set(filenameKey, e.target.result);
                    resolve();
                };
                reader.onerror = () => resolve(); 
                reader.readAsText(file);
            });
        });

        await Promise.all(readPromises);
        
        currentProject.id = null;
        currentProject.name = 'New Upload';
        
        currentProject.html = uploadedFilesMap.get('index.html') || '';
        currentProject.css = uploadedFilesMap.get('style.css') || uploadedFilesMap.get('index.css') || uploadedFilesMap.get('main.css') || '';
        currentProject.js = uploadedFilesMap.get('script.js') || uploadedFilesMap.get('index.js') || uploadedFilesMap.get('main.js') || '';

        updateMiniList();
        validateProject();

    } catch (err) {
        console.error("An error occurred during file processing:", err);
    }
}

function updateMiniList() {
    miniFileList.style.display = uploadedFilesMap.size > 0 ? 'block' : 'none';
    miniFileList.innerHTML = '';
    
    uploadedFilesMap.forEach((val, key) => {
        const div = document.createElement('div');
        div.className = 'mini-file-item';
        div.textContent = key;
        miniFileList.appendChild(div);
    });

    fileCountDisplay.textContent = `Files loaded: ${uploadedFilesMap.size}`;
}

function validateProject() {
    let hasHTML = !!currentProject.html;
    let hasCSS = !!currentProject.css;
    let hasJS = !!currentProject.js;

    const missing = [];
    if (!hasHTML) missing.push("index.html");
    if (!hasCSS) missing.push("CSS file (style/index/main.css)");
    if (!hasJS) missing.push("JavaScript file (script/index/main.js)");

    actionArea.innerHTML = ''; 

    if (missing.length > 0) {
        missingList.innerHTML = '';
        missing.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            missingList.appendChild(li);
        });
        errorDisplay.style.display = 'block';
    } else {
        errorDisplay.style.display = 'none';
        
        const btnView = document.createElement('button');
        btnView.className = 'btn-success';
        btnView.innerHTML = 'View Uploaded Website ▶';
        btnView.onclick = () => launchProject(null, true);
        actionArea.appendChild(btnView);
        
        const btnSave = document.createElement('button');
        btnSave.className = 'btn-base btn-primary';
        btnSave.innerHTML = 'Save Project';
        btnSave.onclick = saveProject;
        actionArea.appendChild(btnSave);
    }
}

// --- PREVIEW LOGIC ---

const contentBlobMap = new Map();

function prepareProjectBlobs(projectData) {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
    contentBlobMap.clear();

    if (projectData.css) {
        const cssBlob = new Blob([projectData.css], { type: 'text/css' });
        const cssUrl = URL.createObjectURL(cssBlob);
        objectUrls.push(cssUrl);
        contentBlobMap.set('style.css', cssUrl);
        contentBlobMap.set('index.css', cssUrl);
        contentBlobMap.set('main.css', cssUrl);
    }

    if (projectData.js) {
        const jsBlob = new Blob([projectData.js], { type: 'text/javascript' });
        const jsUrl = URL.createObjectURL(jsBlob);
        objectUrls.push(jsUrl);
        contentBlobMap.set('script.js', jsUrl);
        contentBlobMap.set('index.js', jsUrl);
        contentBlobMap.set('main.js', jsUrl);
    }
}

function injectAssets(htmlContent, contentMap) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const rewrite = (selector, attr) => {
        doc.querySelectorAll(selector).forEach(el => {
            let rawVal = el.getAttribute(attr);
            if (!rawVal) return;
            
            const cleanPath = rawVal.split('/').pop();
            const filenameKey = decodeURIComponent(cleanPath).trim().toLowerCase();

            const matchUrl = contentMap.get(filenameKey);

            if (matchUrl) {
                el.setAttribute(attr, matchUrl);
            } else {
                console.warn(`[Asset Injector] Asset not found in saved content: "${rawVal}"`);
            }
        });
    };

    rewrite('link[href]', 'href');
    rewrite('script[src]', 'src');

    return doc.documentElement.outerHTML;
}


async function launchProject(projectId, isNewUpload = false) {
    let projectData;

    if (isNewUpload) {
        projectData = currentProject;
    } else {
        projectData = projectsList.find(p => p.id === projectId);
        if (!projectData) {
            console.error("Project not found:", projectId);
            return;
        }
        
        currentProject = {
            id: projectData.id,
            name: projectData.name,
            html: projectData.html,
            css: projectData.css,
            js: projectData.js
        };
    }
    
    prepareProjectBlobs(projectData);

    const finalHtml = injectAssets(projectData.html, contentBlobMap);
    
    const fullDoc = "<!DOCTYPE html>\n" + finalHtml;
    const htmlBlob = new Blob([fullDoc], { type: 'text/html' });
    const finalUrl = URL.createObjectURL(htmlBlob);
    objectUrls.push(finalUrl);

    previewProjectName.textContent = projectData.name;
    switchView('view-workspace');
    previewFrame.src = finalUrl;
    
    fullscreenFrame.src = finalUrl;
}

function toggleFullscreen(isExiting = false) {
    if (isExiting) {
        switchView('view-workspace');
    } else {
        switchView('view-fullscreen');
    }
}

function refreshPreview() {
    launchProject(currentProject.id, !currentProject.id);
}

// --- EDITOR LOGIC ---

async function openEditor(projectId) {
    const projectData = projectsList.find(p => p.id === projectId);
    if (!projectData) return;

    currentProject = {
        id: projectData.id,
        name: projectData.name,
        html: projectData.html,
        css: projectData.css,
        js: projectData.js
    };

    editorHtml.value = currentProject.html;
    editorCss.value = currentProject.css;
    editorJs.value = currentProject.js;
    editorProjectName.textContent = `Editing: ${currentProject.name}`;

    switchView('view-editor');
    switchEditorTab('html');
}

function switchEditorTab(key) {
    editorTabs.forEach(tab => {
        if (tab.dataset.tab === key) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    [editorHtml, editorCss, editorJs].forEach(textarea => {
        if (textarea.dataset.key === key) {
            textarea.classList.add('active');
            textarea.focus();
        } else {
            textarea.classList.remove('active');
        }
    });
}

// --- UTILITY / VIEW MANAGEMENT ---

const allViews = [viewUpload, viewProjects, viewWorkspace, viewEditor, viewLoading, viewFullscreen, saveModalOverlay, deleteModalOverlay, viewAuth];

function switchView(viewId) {
    allViews.forEach(el => {
        el.classList.remove('active');
        if (el.id === 'save-modal-overlay' || el.id === 'delete-modal-overlay') {
            el.style.display = 'none'; 
        }
    });
    
    const target = document.getElementById(viewId);
    target.classList.add('active');
    
    if (viewId === 'save-modal-overlay' || viewId === 'delete-modal-overlay') {
         target.style.display = 'flex';
    }
}

// Expose functions globally for inline HTML usage
window.saveProject = saveProject;
window.confirmSaveProject = confirmSaveProject;
window.cancelSave = cancelSave;
window.saveCodeChanges = saveCodeChanges;
window.launchProject = launchProject;
window.openEditor = openEditor;
window.refreshPreview = refreshPreview;
window.switchView = switchView;
window.resetUploadState = resetUploadState; 
window.toggleFullscreen = toggleFullscreen;
window.deleteProject = deleteProject;
window.confirmDelete = confirmDelete;
window.cancelDelete = cancelSave; 
window.downloadProjectAsZip = downloadProjectAsZip;
window.handleAuthAction = handleAuthAction;
window.toggleAuthMode = toggleAuthMode;
window.userSignOut = userSignOut;
window.signInWithGoogle = signInWithGoogle;

