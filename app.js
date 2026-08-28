// Global State
let qrCodeInstance = null;
let scene, camera, renderer, carModel;
let cameraStream = null;
let currentViewMode = 'exterior'; // 'exterior' or 'interior'
let modelUrl = 'https://raw.githubusercontent.com/mauryadevramesh007/my-3d-models/main/lamborghini_revuelto.glb';
let interiorCameraDistance = 0.5;

// Engine sound (V12 Revuelto sound simulation)
const engineSoundUrl = 'https://assets.mixkit.co/active_storage/sfx/2816/2816-preview.mp3';

// ==================== QR CODE GENERATION ====================
function generateQRForView(viewMode) {
    currentViewMode = viewMode;
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
        mode: viewMode
    });
    
    const shareLink = `${baseUrl}?${params.toString()}`;

    // Clear previous QR code
    const qrCodeDiv = document.getElementById('qrCode');
    qrCodeDiv.innerHTML = '';

    // Generate new QR code
    qrCodeInstance = new QRCode(qrCodeDiv, {
        text: shareLink,
        width: 300,
        height: 300,
        colorDark: '#1a1a1a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // Update UI
    const title = viewMode === 'exterior' ? '🚗 Exterior View' : '🪑 Interior View';
    document.getElementById('qrTitle').textContent = title;
    document.getElementById('qrInfo').textContent = `Scan to view ${title}`;

    // Show QR code container
    document.getElementById('qrCodeContainer').classList.remove('hidden');
}

function downloadQR() {
    const canvas = document.querySelector('#qrCode canvas');
    if (!canvas) {
        alert('Please generate a QR code first');
        return;
    }

    const filename = `revuelto_${currentViewMode}_qr.png`;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
}

function copyQRLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
        mode: currentViewMode
    });
    
    const shareLink = `${baseUrl}?${params.toString()}`;
    
    navigator.clipboard.writeText(shareLink).then(() => {
        alert('Share link copied to clipboard!');
    }).catch(() => {
        alert('Failed to copy link');
    });
}

function backToMenu() {
    document.getElementById('qrCodeContainer').classList.add('hidden');
}

// ==================== AR INITIALIZATION ====================
async function launchARDirect(viewMode) {
    currentViewMode = viewMode;
    await initializeAR();
}

async function initializeAR() {
    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || currentViewMode;
    currentViewMode = mode;

    // Hide QR section, show AR section
    document.getElementById('qrSection').classList.add('hidden');
    document.getElementById('arSection').classList.remove('hidden');
    
    // Update UI
    const modeText = currentViewMode === 'exterior' ? 'Exterior View' : 'Interior Cockpit';
    document.getElementById('viewModeLabel').textContent = modeText;
    document.getElementById('modelDescription').textContent = 'Hybrid Supercar - 1001 HP';
    document.getElementById('loadingIndicator').classList.remove('hidden');

    try {
        // Initialize camera
        await initializeCamera();

        // Initialize Three.js scene
        initializeThreeJS();

        // Load 3D model
        await loadCarModel(modelUrl);

        // Apply view mode
        applyViewMode(currentViewMode);

        // Hide loading indicator
        document.getElementById('loadingIndicator').classList.add('hidden');

    } catch (error) {
        console.error('AR initialization error:', error);
        document.getElementById('loadingIndicator').classList.add('hidden');
        alert('Error initializing AR: ' + error.message);
    }
}

// ==================== CAMERA SETUP ====================
async function initializeCamera() {
    try {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoElement = document.getElementById('cameraFeed');
        videoElement.srcObject = cameraStream;

        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
    } catch (error) {
        throw new Error('Camera access denied or unavailable: ' + error.message);
    }
}

// ==================== THREE.JS SETUP ====================
function initializeThreeJS() {
    const container = document.getElementById('modelContainer');
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x000000, 100, 1000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Enhanced Lighting for Revuelto
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(8, 8, 8);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0xffd700, 0.6);
    pointLight1.position.set(-8, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b6b, 0.4);
    pointLight2.position.set(8, 3, -5);
    scene.add(pointLight2);

    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });

    // Start animation loop
    animate();
}

// ==================== MODEL LOADING ====================
async function loadCarModel(url) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();

        loader.load(
            url,
            (gltf) => {
                carModel = gltf.scene;
                
                // Position model
                carModel.position.set(0, 0, -2);
                carModel.scale.set(1, 1, 1);

                // Center model
                const box = new THREE.Box3().setFromObject(carModel);
                const center = box.getCenter(new THREE.Vector3());
                carModel.position.sub(center);

                // Enable shadows on all meshes
                carModel.traverse((node) => {
                    if (node instanceof THREE.Mesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                scene.add(carModel);
                resolve();
            },
            (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                console.log(`Model loading: ${percent.toFixed(2)}%`);
            },
            (error) => {
                reject(new Error('Failed to load Revuelto model: ' + error.message));
            }
        );
    });
}

// ==================== VIEW MODE CONTROLS ====================
function applyViewMode(mode) {
    if (mode === 'exterior') {
        // Exterior view - show full car
        document.getElementById('cameraControlsGroup').classList.add('hidden');
        resetView();
    } else if (mode === 'interior') {
        // Interior view - position camera inside cockpit
        document.getElementById('cameraControlsGroup').classList.remove('hidden');
        
        // Position for interior view
        document.getElementById('posZ').value = '-0.5';
        document.getElementById('scale').value = '1.5';
        updateModelPosition();
        updateModelScale();
    }
}

function toggleViewMode() {
    currentViewMode = currentViewMode === 'exterior' ? 'interior' : 'exterior';
    applyViewMode(currentViewMode);
    
    const modeText = currentViewMode === 'exterior' ? 'Exterior View' : 'Interior Cockpit';
    const buttonText = currentViewMode === 'exterior' ? 'Switch to Interior' : 'Switch to Exterior';
    
    document.getElementById('viewModeLabel').textContent = modeText;
    document.querySelector('.btn-toggle').textContent = buttonText;
}

function updateCameraView() {
    if (currentViewMode !== 'interior' || !carModel) return;

    const pan = parseFloat(document.getElementById('cameraPan').value);
    const tilt = parseFloat(document.getElementById('cameraTilt').value);

    // Adjust camera position for interior view
    const distance = interiorCameraDistance;
    const x = Math.sin(pan) * Math.cos(tilt) * distance;
    const y = Math.sin(tilt) * distance;
    const z = Math.cos(pan) * Math.cos(tilt) * distance;

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
}

// ==================== ANIMATION LOOP ====================
function animate() {
    requestAnimationFrame(animate);

    // Auto-rotate exterior view
    if (carModel && currentViewMode === 'exterior') {
        carModel.rotation.z += 0.002;
    }

    renderer.render(scene, camera);
}

// ==================== MODEL CONTROLS ====================
function updateModelPosition() {
    if (!carModel) return;

    const posX = parseFloat(document.getElementById('posX').value);
    const posY = parseFloat(document.getElementById('posY').value);
    const posZ = parseFloat(document.getElementById('posZ').value);

    carModel.position.set(posX, posY, posZ);

    // Update display values
    document.getElementById('posXValue').textContent = posX.toFixed(1);
    document.getElementById('posYValue').textContent = posY.toFixed(1);
    document.getElementById('posZValue').textContent = posZ.toFixed(1);
}

function updateModelRotation() {
    if (!carModel) return;

    const rotX = parseFloat(document.getElementById('rotX').value);
    const rotY = parseFloat(document.getElementById('rotY').value);
    const rotZ = parseFloat(document.getElementById('rotZ').value);

    carModel.rotation.set(rotX, rotY, rotZ);
}

function updateModelScale() {
    if (!carModel) return;

    const scale = parseFloat(document.getElementById('scale').value);
    carModel.scale.set(scale, scale, scale);
    document.getElementById('scaleValue').textContent = scale.toFixed(1) + 'x';
}

function resetView() {
    // Reset positions
    document.getElementById('posX').value = '0';
    document.getElementById('posY').value = '0';
    document.getElementById('posZ').value = '-2';
    document.getElementById('rotX').value = '0';
    document.getElementById('rotY').value = '0';
    document.getElementById('rotZ').value = '0';
    document.getElementById('scale').value = '1';
    document.getElementById('cameraPan').value = '0';
    document.getElementById('cameraTilt').value = '0';

    updateModelPosition();
    updateModelRotation();
    updateModelScale();
    updateCameraView();
}

// ==================== AUDIO CONTROLS ====================
function playEngineSound() {
    const audio = document.getElementById('engineAudio');
    audio.src = engineSoundUrl;
    audio.loop = true;
    audio.play().catch((error) => {
        console.log('Audio playback:', error.message);
    });
}

function stopEngineSound() {
    const audio = document.getElementById('engineAudio');
    audio.pause();
    audio.currentTime = 0;
}

// ==================== NAVIGATION ====================
function returnToQR() {
    // Stop audio
    stopEngineSound();

    // Stop camera
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    // Cleanup Three.js
    if (renderer) {
        renderer.dispose();
        document.getElementById('modelContainer').innerHTML = '';
    }

    // Switch sections
    document.getElementById('arSection').classList.add('hidden');
    document.getElementById('qrSection').classList.remove('hidden');
}

// ==================== CHECK FOR URL PARAMS ON LOAD ====================
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mode')) {
        // Auto-initialize AR if mode in params
        currentViewMode = params.get('mode');
        initializeAR();
    }
});
