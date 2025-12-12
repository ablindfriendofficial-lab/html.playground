// Supabase client is loaded via CDN link in index.html, so we can use `supabase.createClient` directly.

// --- SUPABASE CONFIGURATION ---
// IMPORTANT: इस कोड को इस्तेमाल करने के लिए आपको नीचे 'YOUR_LONG_ANON_KEY_HERE' को
// अपनी असली Supabase Anon Public Key से बदलना होगा।

// 1. Project URL (आपके द्वारा दिया गया मान)
const SUPABASE_URL = 'https://nhpfgtmqpslmiywyowtn.supabase.co';

// 2. Anon Public Key (!!! आपको यह मान बदलना होगा !!!)
const SUPABASE_ANON_KEY = 'YOUR_LONG_ANON_KEY_HERE'; 


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

// --- DOM Elements ---
const viewLoading = document.getElementById('view-loading');
const viewUpload = document.getElementById('view-upload');
const viewProjects = document.getElementById('view-projects');
const viewWorkspace = document.getElementById('view-workspace');
const viewFullscreen = document.getElementById('view-fullscreen');
const viewEditor = document.getElementById('view-editor');

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


// --- INITIALIZATION ---

async function initSupabase() {
    // Final check for the placeholder key
    if (SUPABASE_ANON_KEY === 'YOUR_LONG_ANON_KEY_HERE') {
        console.error("Supabase configuration missing! Please update script.js with your Anon Public Key.");
        document.getElementById('loading-spinner').textContent = "❌ KEY MISSING";
        document.getElementById('file-count').textContent = "ERROR: Please update script.js with your Supabase Public Key.";
        return;
    }

    try {
        // 1. Initialize Supabase Client
        // We use the client created globally by the CDN script: `window.supabase.createClient`
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // 2. Perform Anonymous Sign-in (सबसे आसान ऑथेंटिकेशन)
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error) throw error;
        
        // 3. Set User ID and Start Realtime Listener
        userId = data.user.id;
        console.log("Authenticated with userId:", userId);
        
        loadProjects(); // Starts the realtime listener
        switchView('view-upload');

    } catch (error) {
        console.error("Supabase initialization failed:", error.message);
        document.getElementById('loading-spinner').textContent = "❌ Init Failed";
    }
}

// --- DATA / SUPABASE FUNCTIONS ---

function loadProjects() {
    if (supabaseChannel) {
        supabaseChannel.unsubscribe();
    }
    
    // 1. Setup Realtime Channel
    supabaseChannel = supabase
        .channel('public:projects')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'projects' }, 
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
        console.error("Error fetching projects:", error);
        return;
    }

    // Map data to the existing projectsList structure
    projectsList = data.map(p => ({
        id: p.id,
        name: p.name,
        html: p.html,
        css: p.css,
        js: p.js,
        created_at: { toDate: () => new Date(p.created_at) } // Mimic Firebase timestamp structure for rendering
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

// --- SAVE/UPLOAD LOGIC ---

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
            user_id: userId, // Supabase requires user_id explicitly
            name: projectName,
            html: currentProject.html,
            css: currentProject.css,
            js: currentProject.js
            // created_at is handled by PostgreSQL default now()
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
        
        resetUploadState(); // Realtime listener will handle UI refresh

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

        // Manual update to local state for instant feedback
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


// --- UPLOAD / FILE HANDLING LOGIC ---

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

const allViews = [viewUpload, viewProjects, viewWorkspace, viewEditor, viewLoading, viewFullscreen, saveModalOverlay, deleteModalOverlay];

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
window.cancelDelete = cancelDelete;
window.downloadProjectAsZip = downloadProjectAsZip;

