// App ki sthiti
let recordedRoute = [];
let isRecording = false;
let isTracingBack = false;
let currentTargetIndex = 0;
let watchId = null;
let lastAnnouncedDistance = null;

// Configuration
const WAYPOINT_INTERVAL_METERS = 5; 
const ARRIVAL_THRESHOLD_METERS = 4; 

// DOM Elements
const statusText = document.getElementById('status-text');
const statsContainer = document.getElementById('stats-container');
const statWaypoints = document.getElementById('stat-waypoints');
const statDistance = document.getElementById('stat-distance');
const btnRecord = document.getElementById('btn-record');
const btnStopRecord = document.getElementById('btn-stop-record');
const btnTrace = document.getElementById('btn-trace');
const btnReset = document.getElementById('btn-reset');
const indicator = document.getElementById('visual-indicator');

// --- Hardware Interactions ---
function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function playHaptic(type) {
    if (!navigator.vibrate) return;
    if (type === 'success') navigator.vibrate([0, 100, 50, 100]); 
    if (type === 'warning') navigator.vibrate([0, 300, 100, 300]);
    if (type === 'ping') navigator.vibrate(50);
}

// --- UI Updates ---
function updateUI(state, message) {
    statusText.innerText = message;
    
    btnRecord.classList.add('hidden');
    btnStopRecord.classList.add('hidden');
    btnTrace.classList.add('hidden');
    btnReset.classList.add('hidden');
    statsContainer.classList.add('hidden');
    
    indicator.className = ''; 
    
    if (state === 'idle') {
        btnRecord.classList.remove('hidden');
        indicator.classList.add('indicator-idle');
    } 
    else if (state === 'recording') {
        btnStopRecord.classList.remove('hidden');
        statsContainer.classList.remove('hidden');
        indicator.classList.add('indicator-recording');
    }
    else if (state === 'recorded') {
        btnTrace.classList.remove('hidden');
        btnReset.classList.remove('hidden');
        statsContainer.classList.remove('hidden');
        indicator.classList.add('indicator-recorded');
    }
    else if (state === 'tracing') {
        btnReset.classList.remove('hidden');
        statsContainer.classList.remove('hidden');
        indicator.classList.add('indicator-tracing');
    }
    
    statWaypoints.innerText = recordedRoute.length;
}

// --- Core Math Logic ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const radLat1 = lat1 * Math.PI/180;
    const radLat2 = lat2 * Math.PI/180;
    const deltaLat = (lat2-lat1) * Math.PI/180;
    const deltaLon = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(radLat1) * Math.cos(radLat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c); 
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const radLat1 = lat1 * Math.PI/180;
    const radLat2 = lat2 * Math.PI/180;
    const radLon1 = lon1 * Math.PI/180;
    const radLon2 = lon2 * Math.PI/180;

    const y = Math.sin(radLon2-radLon1) * Math.cos(radLat2);
    const x = Math.cos(radLat1)*Math.sin(radLat2) - Math.sin(radLat1)*Math.cos(radLat2)*Math.cos(radLon2-radLon1);
    const theta = Math.atan2(y, x);
    return (theta*180/Math.PI + 360) % 360; 
}

function getDirectionInstruction(userHeading, targetBearing) {
    let diff = targetBearing - userHeading;
    diff = (diff + 540) % 360 - 180; 

    if (Math.abs(diff) <= 30) return "Sidhe chalte rahein.";
    if (diff > 30 && diff <= 100) return "Daein (Right) mudein.";
    if (diff > 100 && diff <= 180) return "Piche mudein.";
    if (diff < -30 && diff >= -100) return "Baein (Left) mudein.";
    if (diff < -100 && diff >= -180) return "Piche mudein.";
    
    return "Disha sahi karein.";
}

// --- App Features ---
function startRecording() {
    if (!navigator.geolocation) {
        speak("GPS is device mein support nahi karta.");
        updateUI('idle', "GPS Error");
        return;
    }

    speak("Recording shuru. Device apne paas rakhein.");
    playHaptic('success');
    
    isRecording = true;
    isTracingBack = false;
    recordedRoute = [];
    statWaypoints.innerText = "0";
    statDistance.innerText = "0m";
    updateUI('recording', "Recording chalu hai...");

    watchId = navigator.geolocation.watchPosition(
        handleRecordingPosition,
        handleGpsError,
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
}

function stopRecording() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    isRecording = false;
    
    if (recordedRoute.length < 2) {
        speak("Rasta bahut chhota hai. Phir se koshish karein.");
        updateUI('idle', "Taiyar hai");
        recordedRoute = [];
        return;
    }
    
    speak("Recording ruk gayi. Wapas jane ke liye Trace Karein button dabayein.");
    playHaptic('success');
    updateUI('recorded', "Rasta save ho gaya!");
}

function handleRecordingPosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    if (accuracy > 30) return; 

    if (recordedRoute.length === 0) {
        recordedRoute.push({ lat: latitude, lng: longitude });
        playHaptic('ping');
        updateUI('recording', "Pehla point save ho gaya.");
        return;
    }

    const lastPoint = recordedRoute[recordedRoute.length - 1];
    const distance = calculateDistance(latitude, longitude, lastPoint.lat, lastPoint.lng);

    if (distance >= WAYPOINT_INTERVAL_METERS) {
        recordedRoute.push({ lat: latitude, lng: longitude });
        statWaypoints.innerText = recordedRoute.length;
        
        let totalDist = parseInt(statDistance.innerText);
        statDistance.innerText = (totalDist + distance) + "m";
        
        playHaptic('ping');
    }
}

function traceBack() {
    if (recordedRoute.length < 2) return;

    if (watchId) navigator.geolocation.clearWatch(watchId);
    
    isRecording = false;
    isTracingBack = true;
    
    recordedRoute.reverse();
    currentTargetIndex = 0;
    lastAnnouncedDistance = null;

    speak(`Wapas navigation shuru. Piche mudein.`);
    playHaptic('success');
    updateUI('tracing', "Navigating...");

    watchId = navigator.geolocation.watchPosition(
        handleTracingPosition,
        handleGpsError,
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
}

function handleTracingPosition(position) {
    if (currentTargetIndex >= recordedRoute.length) {
        finishTracing();
        return;
    }

    const { latitude, longitude, heading, accuracy } = position.coords;
    if (accuracy > 30) return; 

    const target = recordedRoute[currentTargetIndex];
    const distanceToTarget = calculateDistance(latitude, longitude, target.lat, target.lng);
    
    statDistance.innerText = distanceToTarget + "m";
    statWaypoints.innerText = `${currentTargetIndex + 1} / ${recordedRoute.length}`;

    if (distanceToTarget <= ARRIVAL_THRESHOLD_METERS) {
        currentTargetIndex++;
        playHaptic('success');
        
        if (currentTargetIndex >= recordedRoute.length) {
            finishTracing();
        } else {
            speak("Point aa gaya. Aage badhein.");
            updateUI('tracing', "Point mil gaya.");
        }
        return;
    }

    if (heading !== null && !isNaN(heading)) {
        const bearingToTarget = calculateBearing(latitude, longitude, target.lat, target.lng);
        const instruction = getDirectionInstruction(heading, bearingToTarget);
        
        updateUI('tracing', instruction);

        if (instruction !== "Sidhe chalte rahein." && distanceToTarget > 10) {
            if (lastAnnouncedDistance === null || Math.abs(lastAnnouncedDistance - distanceToTarget) > 10) {
                 speak(instruction);
                 playHaptic('warning');
                 lastAnnouncedDistance = distanceToTarget;
            }
        }
    } else {
         updateUI('tracing', `Agle point tak ${distanceToTarget} meter.`);
         if (lastAnnouncedDistance === null || Math.abs(lastAnnouncedDistance - distanceToTarget) >= 10) {
             speak(`${distanceToTarget} meters.`);
             lastAnnouncedDistance = distanceToTarget;
         }
    }
}

function finishTracing() {
    isTracingBack = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    speak("Aap apne destination par pahunch gaye hain.");
    playHaptic('success');
    updateUI('idle', "Rasta Pura Hua.");
    recordedRoute = [];
}

function resetApp() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    isRecording = false;
    isTracingBack = false;
    recordedRoute = [];
    speak("Rasta reset kar diya gaya hai.");
    playHaptic('warning');
    updateUI('idle', "Taiyar hai");
}

function handleGpsError(error) {
    console.warn(`GPS Error: ${error.message}`);
    if (error.code === 1) { 
        speak("Kripya location access allow karein.");
        updateUI('idle', "Location Denied");
        resetApp();
    }
}
