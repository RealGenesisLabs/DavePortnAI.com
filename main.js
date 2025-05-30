import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, model, neckBone;
let mouseX = 0, mouseY = 0;
let controls;
let orbitRadiusX = 700; // Horizontal radius
let orbitRadiusY = 350; // Vertical radius
let orbitSpeed = 0.0010; // Base speed of orbit
let currentOrbitSpeed = orbitSpeed;
let videoElements = [];
let hoveredVideo = null;
let zOffset = 900; // Maximum z-axis offset for the orbital rotation

// --- Pizza Variables ---
let pizzas = [];
let draggedPizza = null;
let pizzaLoader; // Separate loader for pizza
let modelScale = 1; // Keep track of the model's scale

// --- Custom Cursor ---
let pizzaCursor;

// Add audio variables
let loadingProgress = 0; // Change to a single progress value
let loadingInterval = null; // Single interval for loading/unloading
let videoAudios = {};
let activeVideo = null; // Track which video is currently being hovered
let circularProgress = null; // Single progress circle for all videos
let isLoading = false; // Track if we're currently loading or unloading

// Add Audio Analysis variables
let audioContext;
let audioAnalyser;
let audioDataArray;
const AUDIO_SAMPLES = 32; // Number of samples to analyze

// Add head bobbing animation parameters
let isAudioPlaying = false;
let headBobTime = 0;
let headBobSpeed = 0.055;
let headBobAmplitude = 1.4;
let headBobSmoothing = 0.25; // Increased smoothing for waveform movement
let currentHeadTilt = 0;

// Add new audio variables
let pumpFunAudio;
let headClickAudios = []; // Array to hold all mouse click audio elements
let lastPlayedClickIndex = -1; // Track the last played click sound
let isPumpFunAudioPlaying = false;
let isHeadAudioPlaying = false;

// Add the new setup function for X logo audio
let isXLogoAudioPlaying = false;

// Add creepy mode variables
let isCreepyMode = false;
let creepyInterval;
let originalLights = [];
let originalScale;
let creepyAudio;
let creepyAudio2;
let releaseMeAudio;
let creepyStartTime;
let originalCameraZ; // Add this with other creepy mode variables
const CREEPY_DURATION = 10000; // 10 seconds

// --- Function to set initial model opacity ---
function setInitialModelOpacity() {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0; // Set to 0 initially
      }
    });
  }
}

// Intro animation functions
function typeWriter(element, text, speed = 50) {
    return new Promise(resolve => {
        let i = 0;
        element.style.opacity = '1';
        function type() {
            if (i < text.length) {
                if (text.charAt(i) === '<') {
                    let endIndex = text.indexOf('>', i);
                    element.innerHTML += text.substring(i, endIndex + 1);
                    i = endIndex + 1;
                } else {
                    element.innerHTML += text.charAt(i);
                    i++;
                }
                setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

async function playIntroAnimation() {
    const overlay = document.getElementById('intro-overlay');
    const loadingContainer = document.getElementById('loading-container');
    const loadingProgress = document.getElementById('loading-progress');
    const introVideo = document.getElementById('intro-video');
    const endFrame = document.getElementById('end-frame');
    const logoAnimation = document.getElementById('logo-animation');
    const enterButton = document.getElementById('enter-button');
    
    // Start playing the logo animation
    try {
        await logoAnimation.play();
        // Pause on last frame when video ends
        logoAnimation.addEventListener('ended', () => {
            logoAnimation.currentTime = logoAnimation.duration;
        }, { once: true });
    } catch (error) {
        console.error("Error playing logo animation:", error);
    }
    
    // Show and animate loading bar
    loadingProgress.style.width = '100%';
    
    // After loading completes, show the enter button
    await new Promise(resolve => setTimeout(resolve, 4000)); 
    enterButton.style.display = 'block';
    setTimeout(() => {
        enterButton.style.opacity = '1';
    }, 50);

    // Wait for user to click enter button before continuing
    await new Promise(resolve => {
        enterButton.addEventListener('click', () => {
            // Start playing background music
            const backgroundMusic = document.getElementById('background-music');
            backgroundMusic.volume = 0.3; // Set to 30% volume
            try {
                backgroundMusic.play();
            } catch (error) {
                console.error("Error playing background music:", error);
            }

            // Fade out button
            enterButton.style.opacity = '0';
            setTimeout(() => {
                enterButton.style.display = 'none';
                resolve();
            }, 500);

            // Play intro audio after 2 seconds
            setTimeout(() => {
                const introAudio = document.getElementById('intro-audio');
                introAudio.volume = 1; // Full volume for voice
                try {
                    introAudio.play();
                } catch (error) {
                    console.error("Error playing intro audio:", error);
                }
            }, 1500);
        });
    });
    
    // Continue with the rest of the intro sequence
    overlay.style.transition = 'opacity 1s';
    overlay.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 1000));
    overlay.style.display = 'none';
    
    // Show intro video
    introVideo.style.display = 'block';
    introVideo.muted = true;
    introVideo.src = "./Assets/IntroVideo.mp4";
    introVideo.load();

    try {
        await introVideo.play();
        setTimeout(() => introVideo.style.opacity = '1', 50);
    } catch (error) {
        console.error("Error playing video:", error);
        introVideo.style.display = 'none';
        endFrame.style.display = 'block';
        if (typeof showVideos === 'function') {
            showVideos();
        }
        return;
    }
    
    // Start zoom/light/opacity animation after a delay
    setTimeout(() => {
        // --- Zoom, Light, and Opacity Animation ---
        const initialZ = 10;
        camera.position.z = initialZ;
        const targetZ = 3;
        const zoomDuration = 2000;
        const startTime = Date.now();
        const targetAmbientIntensity = 0.7;
        const targetDirectionalIntensity = 1.2;

        // --- Opacity Animation ---
        const initialOpacity = 0;
        const targetOpacity = 1;
        if (model) {
          model.traverse((child) => {
            if (child.isMesh) {
              child.material.transparent = true; // Ensure material supports transparency
              child.material.opacity = initialOpacity; // Start with 0 opacity
            }
          });
        }

        const ambientLight = scene.children.find(child => child instanceof THREE.AmbientLight);
        const directionalLight = scene.children.find(child => child instanceof THREE.DirectionalLight);
        const initialAmbientIntensity = ambientLight.intensity;
        const initialDirectionalIntensity = directionalLight.intensity;

        // Start the zoom-in animation
        const zoomPromise = new Promise(resolve => {
            function zoomIn() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / zoomDuration, 1);
                camera.position.z = initialZ - (initialZ - targetZ) * progress;
                if (ambientLight && directionalLight) {
                    ambientLight.intensity = initialAmbientIntensity + (targetAmbientIntensity - initialAmbientIntensity) * progress;
                    directionalLight.intensity = initialDirectionalIntensity + (targetDirectionalIntensity - initialDirectionalIntensity) * progress;
                }

                // --- Animate Opacity ---
                if (model) {
                  const currentOpacity = initialOpacity + (targetOpacity - initialOpacity) * progress;
                  model.traverse((child) => {
                    if (child.isMesh) {
                      child.material.opacity = currentOpacity;
                    }
                  });
                }

                if (progress < 1) {
                    requestAnimationFrame(zoomIn);
                } else {
                    if (typeof showVideos === 'function') {
                        showVideos();
                    }
                    resolve();
                }
            }
            zoomIn();
        });
    }, 3000);

    // --- Wait for video to end, THEN show end frame ---
    introVideo.addEventListener('ended', () => {
        introVideo.pause();
        introVideo.style.display = 'none';
        endFrame.style.display = 'block';

        // Fade in the logo, contract address, app store badges, X logo, and creepy button
        const pumpFunContainer = document.getElementById('pump-fun-container');
        const appStoreBadges = document.getElementById('app-store-badges');
        const xLogoContainer = document.getElementById('x-logo-container');
        const creepyButton = document.getElementById('creepy-button');
        
        if (pumpFunContainer) {
            pumpFunContainer.style.opacity = '1';
        }
        if (appStoreBadges) {
            appStoreBadges.style.opacity = '1';
        }
        if (xLogoContainer) {
            xLogoContainer.style.opacity = '1';
        }
        if (creepyButton) {
            creepyButton.style.opacity = '1';
        }
    }, { once: true });
}

function showVideos() {
    const videos = document.querySelectorAll('.video-container');
    videoElements = Array.from(videos);

    // Position ElevenLabs widget beneath the head
    const elevenLabsWidget = document.getElementById('elevenlabs-widget');
    if (elevenLabsWidget) {
        // Position it at the bottom of the orbital circle
        const angle = Math.PI / 2; // 90 degrees - bottom of the circle
        const x = Math.cos(angle) * (orbitRadiusX * 0.3); // Reduced radius more
        const y = Math.sin(angle) * (orbitRadiusY * 0.8); // Adjusted Y position
        const z = 0; // Set Z to 0 to keep it in front
        
        elevenLabsWidget.style.transform = `translate(-50%, -50%) 
                                          translate3d(${x}px, ${y + 60}px, ${z}px)`;
        
        // Move these lines after the transform
        elevenLabsWidget.style.display = 'block';
        elevenLabsWidget.style.left = '50%';
        elevenLabsWidget.style.top = '50%';
        
        setTimeout(() => {
            elevenLabsWidget.style.opacity = '1';
        }, 50);
    }

    // Create single circular progress element
    circularProgress = document.createElement('div');
    circularProgress.classList.add('circular-progress');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    
    circle.setAttribute('r', radius);
    circle.setAttribute('cx', '25');
    circle.setAttribute('cy', '25');
    circle.setAttribute('stroke-dasharray', circumference);
    circle.setAttribute('stroke-dashoffset', circumference);
    
    svg.appendChild(circle);
    circularProgress.appendChild(svg);
    document.body.appendChild(circularProgress);

    // Set initial positions and add Twitter icon
    videoElements.forEach((video, index) => {
        const angle = (index / videoElements.length) * Math.PI * 2;
        video.angle = angle;
        video.dataset.index = index;
        
        // Create and set up audio element
        const audio = new Audio();
        audio.src = `Assets/Audio/Video/video${index + 1}.mp3`;
        audio.volume = 0.5;
        videoAudios[index] = audio;

        video.addEventListener('mouseenter', (e) => {
            handleVideoHover(video, true);
            startLoading(video, index);
        });
        video.addEventListener('mouseleave', () => {
            handleVideoHover(video, false);
            startUnloading(video, index);
        });

        // --- Add Twitter Icon ---
        const twitterIcon = document.createElement('a'); // Create an anchor tag
        twitterIcon.href = '#';  // Placeholder.  We'll set this dynamically.
        twitterIcon.target = '_blank'; // Open in a new tab/window
        twitterIcon.classList.add('twitter-icon'); // For styling

        const iconImg = document.createElement('img');
        iconImg.src = 'Assets/Twitter.svg';
        iconImg.alt = 'Share on Twitter';
        twitterIcon.appendChild(iconImg);

        video.appendChild(twitterIcon); // Add icon to the video container

        // --- Set Tweet Content (Different for each video) ---
        // Get Streamable link from the iframe within the video container
        let streamableLink = video.querySelector('iframe').src;

        // --- Clean up the Streamable link ---
        // 1. Remove '/e/'
        streamableLink = streamableLink.replace('/e/', '/');

        // 2. Remove query parameters (everything after '?')
        const questionMarkIndex = streamableLink.indexOf('?');
        if (questionMarkIndex !== -1) {
            streamableLink = streamableLink.substring(0, questionMarkIndex);
        }

        let tweetText = `@stoolpresidente this you?\n\nwww.DavePortnAI.com\n\n ${streamableLink}`;

        // --- Create Twitter Share URL ---
        const twitterShareURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        twitterIcon.href = twitterShareURL;

        setTimeout(() => {
            video.classList.add('show');
            updateVideoPosition(video);
        }, index * 300);
    });

    // Add global mouse move listener
    document.addEventListener('mousemove', updateGlobalProgressPosition);

    // Start the orbital animation
    animateVideos();
}

function updateVideoPosition(video) {
    const angle = video.angle;
    const x = Math.cos(angle) * orbitRadiusX;
    const y = Math.sin(angle) * orbitRadiusY;
    // Add z-axis movement using sine wave
    const z = Math.sin(angle) * zOffset;
    
    const scale = hoveredVideo ? (video === hoveredVideo ? 1.2 : 0.8) : 1;
    const opacity = hoveredVideo ? (video === hoveredVideo ? 1 : 0.7) : 1;
    
    // Calculate rotation based on position in orbit
    const rotateX = Math.sin(angle) * 15; // Tilt up/down
    const rotateY = Math.cos(angle) * 15; // Tilt left/right
    
    video.style.transform = `translate(-50%, -50%) 
                            translate3d(${x}px, ${y}px, ${z}px) 
                            rotateX(${rotateX}deg) 
                            rotateY(${rotateY}deg)
                            scale(${scale})`;
    video.style.opacity = opacity;
    
    // Adjust z-index based on z position for proper layering
    video.style.zIndex = Math.round(z + 1000);
}

function handleVideoHover(video, isHovered) {
    hoveredVideo = isHovered ? video : null;
    currentOrbitSpeed = isHovered ? orbitSpeed * 0.2 : orbitSpeed;
    
    if (isHovered) {
        const angle = video.angle;
        const x = Math.cos(angle) * (orbitRadiusX * 0.90); // How much the video is moved away from the center
        const y = Math.sin(angle) * (orbitRadiusY * 0.95); // How much the video is moved away from the center
        const z = Math.sin(angle) * zOffset + 200; // Bring it closer to camera
        
        video.style.transform = `translate(-50%, -50%) 
                                translate3d(${x}px, ${y}px, ${z}px) 
                                rotateX(0deg) 
                                rotateY(0deg)
                                scale(1.2)`;
        video.style.zIndex = 2000; // Always on top when hovered
    } else {
        updateVideoPosition(video);
    }
    
    // Update other videos' positions
    videoElements.forEach(v => {
        if (v !== video) {
            updateVideoPosition(v);
        }
    });
}

function animateVideos() {
    if (videoElements.length > 0) {
        videoElements.forEach(video => {
            video.angle += currentOrbitSpeed;
            if (!hoveredVideo || video !== hoveredVideo) {
                updateVideoPosition(video);
            }
        });
    }
    requestAnimationFrame(animateVideos);
}


// --- Pizza Functions ---

function createPizza() {
    pizzaLoader.load(
        '/models/pizza.glb',
        function (gltf) {
            const pizza = gltf.scene;
            pizza.scale.set(0.1, 0.1, 0.1); // Adjust scale as needed

            // Random initial position and velocity
            const x = (Math.random() * 2 - 1) * window.innerWidth / 2;
            const y = (Math.random() * 2 - 1) * window.innerHeight / 2;
            const z = 0; // Start at z=0

            const vx = (Math.random() * 2 - 1) * 5;
            const vy = (Math.random() * 2 - 1) * 5;
            const vz = (Math.random() * 2 - 1) * 2; // Slower z velocity

            pizza.userData.position = new THREE.Vector3(x, y, z);
            pizza.userData.velocity = new THREE.Vector3(vx, vy, vz);
            pizza.userData.rotationSpeed = new THREE.Vector3(
                Math.random() * 0.1 - 0.05,
                Math.random() * 0.1 - 0.05,
                Math.random() * 0.1 - 0.05
            );

            const pizzaContainer = document.createElement('div');
            pizzaContainer.classList.add('pizza-container');
            pizzaContainer.style.position = 'absolute';
            pizzaContainer.style.left = `${x}px`;
            pizzaContainer.style.top = `${y}px`;
            pizzaContainer.style.width = '50px';  // Adjust as needed
            pizzaContainer.style.height = '50px'; // Adjust as needed
            pizzaContainer.appendChild(pizza.rendererNode); // Add to the DOM.  Important!
            document.getElementById('scene-container').appendChild(pizzaContainer);

            pizza.userData.container = pizzaContainer; // Store the container
            pizzas.push(pizza);
            scene.add(pizza); // Add to the Three.js scene

            pizzaContainer.addEventListener('mousedown', (event) => {
                draggedPizza = pizza;
                event.preventDefault(); // Prevent text selection, etc.
            });

        },
        undefined,
        function (error) {
            console.error('An error occurred loading the pizza model:', error);
        }
    );
}


function animatePizza() {
    for (let i = 0; i < pizzas.length; i++) {
        const pizza = pizzas[i];
        if (!pizza) continue; // Skip if pizza is null/undefined

        if (draggedPizza !== pizza) {
            // Update position
            pizza.userData.position.x += pizza.userData.velocity.x;
            pizza.userData.position.y += pizza.userData.velocity.y;
            pizza.userData.position.z += pizza.userData.velocity.z;

            // Bounce off edges
            if (pizza.userData.position.x > window.innerWidth / 2 || pizza.userData.position.x < -window.innerWidth / 2) {
                pizza.userData.velocity.x *= -1;
            }
            if (pizza.userData.position.y > window.innerHeight / 2 || pizza.userData.position.y < -window.innerHeight / 2) {
                pizza.userData.velocity.y *= -1;
            }
            // Add some z-axis boundaries, adjust as needed
            if (pizza.userData.position.z > 200 || pizza.userData.position.z < -200) {
                pizza.userData.velocity.z *= -1;
            }

            // Apply rotation
            pizza.rotation.x += pizza.userData.rotationSpeed.x;
            pizza.rotation.y += pizza.userData.rotationSpeed.y;
            pizza.rotation.z += pizza.userData.rotationSpeed.z;

            // Update container position
            if (pizza.userData.container) {
                pizza.userData.container.style.left = `${pizza.userData.position.x + window.innerWidth / 2}px`;
                pizza.userData.container.style.top = `${pizza.userData.position.y + window.innerHeight / 2}px`;
                pizza.userData.container.style.transform = `translate(-50%, -50%) rotateX(${pizza.rotation.x}rad) rotateY(${pizza.rotation.y}rad) rotateZ(${pizza.rotation.z}rad)`;
            }
        }
    }
}


// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = null; // Remove black background

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;  // Start further back for zoom effect

    // Create renderer with transparency
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true // Enable transparency
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Add lights with initial dim intensity
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.0); // Start dimmer
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.0); // Start dimmer
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Load the 3D model
    const loader = new GLTFLoader();
    loader.load(
        '/models/head.glb',
        function (gltf) {
            model = gltf.scene;
            // Scale down the model by 25%
            model.scale.set(0.75, 0.75, 0.75);
            scene.add(model);

            // Find the neck bone in the model
            model.traverse((object) => {
                if (object.isBone && object.name.toLowerCase().includes('neck')) {
                    neckBone = object;
                    console.log('Found neck bone:', neckBone.name);
                }
            });

            // Center the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // --- Set initial opacity AFTER model is loaded ---
            setInitialModelOpacity();

            // Start intro animation after model is loaded
            playIntroAnimation();

            // Add these new setup calls
            setupPumpFunAudio();
            setupHeadClickAudio();
            setupAppStoreAudio();
            setupXLogoAudio();
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error occurred loading the model:', error);
        }
    );

    // --- Pizza Loader Setup ---
    pizzaLoader = new GLTFLoader();

    // --- Create Custom Cursor ---
    pizzaCursor = document.getElementById('pizza-cursor');
    if (pizzaCursor) {
        // Ensure cursor is visible immediately
        pizzaCursor.style.display = 'block';
    }

    // Add orbit controls with restrictions
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // Disable zooming
    controls.enablePan = false; // Disable panning
    controls.enableRotate = false; // Disable rotation
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Add mouse move event listener
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    // --- Mouse Up (for dragging) ---
    document.addEventListener('mouseup', () => {
        draggedPizza = null;
        if (pizzaCursor) {
            pizzaCursor.style.display = 'block'; // Show custom cursor
        }
    });

    // --- Spawn Pizzas ---
    setInterval(createPizza, 60000); // Create a pizza every 60 seconds

    // Setup creepy audio tracks
    creepyAudio = new Audio('Assets/Audio/CreepyTransform.mp3');
    creepyAudio.volume = 1;
    
    creepyAudio2 = new Audio('Assets/Audio/CreepyTransform2.mp3');
    creepyAudio2.volume = 0;

    releaseMeAudio = new Audio('Assets/Audio/ReleaseMeDave.mp3');
    releaseMeAudio.volume = 0;

    // Setup creepy button
    const creepyButton = document.getElementById('creepy-button');
    if (creepyButton) {
        creepyButton.addEventListener('click', toggleCreepyMode);
    }
}

// Handle mouse movement
function onMouseMove(event) {
    // Calculate normalized mouse coordinates (-1 to +1)
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

    // --- Update Custom Cursor Position ---
    if (pizzaCursor) {
        pizzaCursor.style.left = `${event.clientX - pizzaCursor.offsetWidth / 2}px`;
        pizzaCursor.style.top = `${event.clientY - pizzaCursor.offsetHeight / 2}px`;

        // Remove display toggle - cursor should always be visible
        // Check if mouse is over the head model
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        if (model) {
            const intersects = raycaster.intersectObjects(model.children, true);
            if (intersects.length > 0 && intersects[0].object.userData.clickable) {
                pizzaCursor.classList.add('pulsing');
            } else {
                pizzaCursor.classList.remove('pulsing');
            }
        }
    }

    if (draggedPizza) {
        // Convert mouse coordinates to world coordinates
        const vec = new THREE.Vector3(mouseX, mouseY, 0.5);
        vec.unproject(camera);
        const dir = vec.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        const pos = camera.position.clone().add(dir.multiplyScalar(distance));

        // Update pizza position (only x and y, keep z for depth)
        draggedPizza.userData.position.x = pos.x;
        draggedPizza.userData.position.y = pos.y;

        // --- Feeding Logic ---
        // Estimate mouth position (adjust these values based on your model)
        const mouthPosition = new THREE.Vector3(
            model.position.x,
            model.position.y - 1,  // Adjust based on your model
            model.position.z + 2   // Adjust based on your model
        );

        const distanceToMouth = draggedPizza.userData.position.distanceTo(mouthPosition);

        if (distanceToMouth < 2) { // Adjust threshold as needed
            // "Feed" the pizza
            modelScale += 0.15; // Increase scale by 15%
            model.scale.set(0.75 * modelScale, 0.75 * modelScale, 0.75 * modelScale);

            // Remove the pizza from the scene and array
            scene.remove(draggedPizza);
            const index = pizzas.indexOf(draggedPizza);
            if (index > -1) {
                pizzas.splice(index, 1);
            }
            // Remove pizza container
            if(draggedPizza.userData.container) {
                draggedPizza.userData.container.remove();
            }

            draggedPizza = null; // Reset draggedPizza
        }
    }
}

// Handle window resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize Audio Context
function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 64; // Keep the FFT size small for performance
    audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
}

// Setup audio analysis for a given audio element
function setupAudioAnalysis(audio) {
    if (!audioContext) {
        initAudioContext();
    }

    const source = audioContext.createMediaElementSource(audio);
    source.connect(audioAnalyser);
    audioAnalyser.connect(audioContext.destination);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (neckBone) {
        // Calculate rotation based on mouse position
        const targetRotationX = -mouseY * 0.8;
        const targetRotationY = mouseX * 0.8;

        // Update head tilt animation based on audio waveform
        if ((isAudioPlaying || isPumpFunAudioPlaying || isHeadAudioPlaying) && audioAnalyser) {
            // Get waveform data
            audioAnalyser.getByteTimeDomainData(audioDataArray);
            
            // Calculate average volume from waveform
            let sum = 0;
            for (let i = 0; i < audioDataArray.length; i++) {
                // Convert waveform data to a -1 to 1 range
                const amplitude = (audioDataArray[i] - 128) / 128;
                sum += Math.abs(amplitude);
            }
            const averageVolume = sum / audioDataArray.length;
            
            // Normalize volume to hit 100% at 80% actual volume
            // 0.8 is our target max volume, so we divide by 0.8 to make that map to 1.0
            const normalizedVolume = Math.min(averageVolume / 0.8, 1.0);
            
            // Use the normalized volume to drive head movement
            const targetTilt = normalizedVolume * headBobAmplitude;
            
            // Smoothly interpolate to the target tilt
            currentHeadTilt += (targetTilt - currentHeadTilt) * headBobSmoothing;
        } else {
            // Smoothly return to neutral position when not playing
            currentHeadTilt *= 0.95;
        }

        // Combine mouse-based rotation with head tilting
        neckBone.rotation.x += (targetRotationX + currentHeadTilt - neckBone.rotation.x) * 0.1;
        neckBone.rotation.y += (targetRotationY - neckBone.rotation.y) * 0.1;
    }

    animatePizza();
    renderer.render(scene, camera);
}

function startLoading(video, index) {
    // Reset progress when starting a new loading animation
    loadingProgress = 0;
    activeVideo = video;
    isLoading = true;
    
    if (loadingInterval) {
        clearInterval(loadingInterval);
    }
    
    circularProgress.style.display = 'block';
    updateProgressCircle(); // Update circle immediately with reset progress
    
    const duration = 2000;
    const interval = 50;
    const steps = duration / interval;
    const increment = 100 / steps; // Simplified since we're starting from 0
    
    loadingInterval = setInterval(() => {
        if (!isLoading) return;
        
        loadingProgress = Math.min(100, loadingProgress + increment);
        updateProgressCircle();
        
        if (loadingProgress >= 100) {
            clearInterval(loadingInterval);
            if (activeVideo === video && videoAudios[index]) {
                const audio = videoAudios[index];
                // Setup audio analysis before playing
                if (!audio.analysisSetup) {
                    setupAudioAnalysis(audio);
                    audio.analysisSetup = true;
                }
                audio.currentTime = 0;
                audio.play();
                isAudioPlaying = true;
            }
        }
    }, interval);
}

function startUnloading(video, index) {
    isLoading = false;
    isAudioPlaying = false;
    
    if (loadingInterval) {
        clearInterval(loadingInterval);
    }
    
    // Only start unloading animation if this is the active video
    if (activeVideo !== video) {
        loadingProgress = 0;
        updateProgressCircle();
        circularProgress.style.display = 'none';
        return;
    }
    
    const duration = 500;
    const interval = 50;
    const steps = duration / interval;
    const decrement = loadingProgress / steps;
    
    loadingInterval = setInterval(() => {
        loadingProgress = Math.max(0, loadingProgress - decrement);
        updateProgressCircle();
        
        if (loadingProgress <= 0) {
            clearInterval(loadingInterval);
            circularProgress.style.display = 'none';
            if (videoAudios[index]) {
                videoAudios[index].pause();
                videoAudios[index].currentTime = 0;
            }
            activeVideo = null;
        }
    }, interval);
}

function updateProgressCircle() {
    const circle = circularProgress.querySelector('circle');
    const radius = parseFloat(circle.getAttribute('r'));
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (loadingProgress / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

function updateGlobalProgressPosition(event) {
    if (circularProgress) {
        const x = event.clientX - circularProgress.offsetWidth / 2;
        const y = event.clientY - circularProgress.offsetHeight / 2;
        circularProgress.style.left = `${x}px`;
        circularProgress.style.top = `${y}px`;
    }
}

// Add new function to handle pump fun logo hover
function setupPumpFunAudio() {
    pumpFunAudio = document.getElementById('pump-fun-audio');
    const pumpFunLogo = document.getElementById('pump-fun-logo');
    let pumpFunLoadingInterval;
    let pumpFunProgress = 0;

    // Helper function to play audio
    const playPumpFunAudio = () => {
        if (!isPumpFunAudioPlaying) {
            if (!pumpFunAudio.analysisSetup) {
                setupAudioAnalysis(pumpFunAudio);
                pumpFunAudio.analysisSetup = true;
            }
            pumpFunAudio.currentTime = 0;
            pumpFunAudio.play();
            isPumpFunAudioPlaying = true;

            // Add ended event listener to reset the state
            pumpFunAudio.addEventListener('ended', () => {
                isPumpFunAudioPlaying = false;
            }, { once: true });
        }
    };

    // Add click handler - removed preventDefault() so link still works
    pumpFunLogo.addEventListener('click', () => {
        playPumpFunAudio();
    });

    pumpFunLogo.addEventListener('mouseenter', () => {
        // Reset and show progress circle
        pumpFunProgress = 0;
        circularProgress.style.display = 'block';
        updateProgressCircle();

        if (pumpFunLoadingInterval) clearInterval(pumpFunLoadingInterval);

        const duration = 2000;
        const interval = 50;
        const steps = duration / interval;
        const increment = 100 / steps;

        pumpFunLoadingInterval = setInterval(() => {
            pumpFunProgress = Math.min(100, pumpFunProgress + increment);
            loadingProgress = pumpFunProgress; // Update global progress for circle
            updateProgressCircle();

            if (pumpFunProgress >= 100) {
                clearInterval(pumpFunLoadingInterval);
                playPumpFunAudio(); // Use the helper function here
            }
        }, interval);
    });

    pumpFunLogo.addEventListener('mouseleave', () => {
        if (pumpFunLoadingInterval) clearInterval(pumpFunLoadingInterval);
        
        const duration = 500;
        const interval = 50;
        const steps = duration / interval;
        const decrement = pumpFunProgress / steps;

        pumpFunLoadingInterval = setInterval(() => {
            pumpFunProgress = Math.max(0, pumpFunProgress - decrement);
            loadingProgress = pumpFunProgress;
            updateProgressCircle();

            if (pumpFunProgress <= 0) {
                clearInterval(pumpFunLoadingInterval);
                circularProgress.style.display = 'none';
            }
        }, interval);
    });
}

// Add new function to handle head click
function setupHeadClickAudio() {
    // Create and setup all audio elements for mouse clicks
    for (let i = 1; i <= 7; i++) {
        const audio = new Audio(`Assets/Audio/MouseClick/mouse${i}.mp3`);
        headClickAudios.push(audio);
    }
    
    // Make the model clickable
    if (model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.userData.clickable = true;
            }
        });

        // Add click event listener to the renderer's canvas
        renderer.domElement.addEventListener('click', (event) => {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Create a raycaster
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            // Check for intersections with the model
            const intersects = raycaster.intersectObjects(model.children, true);

            if (intersects.length > 0 && intersects[0].object.userData.clickable) {
                // Get a random index different from the last played
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * headClickAudios.length);
                } while (randomIndex === lastPlayedClickIndex && headClickAudios.length > 1);
                
                lastPlayedClickIndex = randomIndex;
                const selectedAudio = headClickAudios[randomIndex];

                // Setup audio analysis if not already done
                if (!selectedAudio.analysisSetup) {
                    setupAudioAnalysis(selectedAudio);
                    selectedAudio.analysisSetup = true;
                }

                selectedAudio.currentTime = 0;
                selectedAudio.play();
                isHeadAudioPlaying = true;

                // Add event listener for when audio ends
                selectedAudio.addEventListener('ended', () => {
                    isHeadAudioPlaying = false;
                }, { once: true });
            }
        });
    }
}

// Add the new setup function for app store badges audio
function setupAppStoreAudio() {
    const appStoreAudio = document.getElementById('app-store-audio');
    const appStoreBadges = document.getElementById('app-store-badges');
    let appStoreLoadingInterval;
    let appStoreProgress = 0;

    // Helper function to play audio
    const playAppStoreAudio = () => {
        if (!isPumpFunAudioPlaying) {
            if (!appStoreAudio.analysisSetup) {
                setupAudioAnalysis(appStoreAudio);
                appStoreAudio.analysisSetup = true;
            }
            appStoreAudio.currentTime = 0;
            appStoreAudio.play();
            isPumpFunAudioPlaying = true;

            // Add ended event listener to reset the state
            appStoreAudio.addEventListener('ended', () => {
                isPumpFunAudioPlaying = false;
            }, { once: true });
        }
    };

    // Add click handler
    appStoreBadges.addEventListener('click', () => {
        playAppStoreAudio();
    });

    appStoreBadges.addEventListener('mouseenter', () => {
        // Reset and show progress circle
        appStoreProgress = 0;
        circularProgress.style.display = 'block';
        updateProgressCircle();

        if (appStoreLoadingInterval) clearInterval(appStoreLoadingInterval);

        const duration = 2000;
        const interval = 50;
        const steps = duration / interval;
        const increment = 100 / steps;

        appStoreLoadingInterval = setInterval(() => {
            appStoreProgress = Math.min(100, appStoreProgress + increment);
            loadingProgress = appStoreProgress; // Update global progress for circle
            updateProgressCircle();

            if (appStoreProgress >= 100) {
                clearInterval(appStoreLoadingInterval);
                playAppStoreAudio();
            }
        }, interval);
    });

    appStoreBadges.addEventListener('mouseleave', () => {
        if (appStoreLoadingInterval) clearInterval(appStoreLoadingInterval);
        
        const duration = 500;
        const interval = 50;
        const steps = duration / interval;
        const decrement = appStoreProgress / steps;

        appStoreLoadingInterval = setInterval(() => {
            appStoreProgress = Math.max(0, appStoreProgress - decrement);
            loadingProgress = appStoreProgress;
            updateProgressCircle();

            if (appStoreProgress <= 0) {
                clearInterval(appStoreLoadingInterval);
                circularProgress.style.display = 'none';
            }
        }, interval);
    });
}

// Add the new setup function for X logo audio
function setupXLogoAudio() {
    const xLogoAudio = document.getElementById('x-logo-audio');
    const xLogo = document.getElementById('x-logo');
    let xLogoLoadingInterval;
    let xLogoProgress = 0;

    // Helper function to play audio
    const playXLogoAudio = () => {
        if (!isPumpFunAudioPlaying) {
            if (!xLogoAudio.analysisSetup) {
                setupAudioAnalysis(xLogoAudio);
                xLogoAudio.analysisSetup = true;
            }
            xLogoAudio.currentTime = 0;
            xLogoAudio.play();
            isPumpFunAudioPlaying = true;

            // Add ended event listener to reset the state
            xLogoAudio.addEventListener('ended', () => {
                isPumpFunAudioPlaying = false;
            }, { once: true });
        }
    };

    if (xLogo) {
        // Add click handler
        xLogo.addEventListener('click', () => {
            playXLogoAudio();
        });

        xLogo.addEventListener('mouseenter', () => {
            // Reset and show progress circle
            xLogoProgress = 0;
            circularProgress.style.display = 'block';
            updateProgressCircle();

            if (xLogoLoadingInterval) clearInterval(xLogoLoadingInterval);

            const duration = 2000;
            const interval = 50;
            const steps = duration / interval;
            const increment = 100 / steps;

            xLogoLoadingInterval = setInterval(() => {
                xLogoProgress = Math.min(100, xLogoProgress + increment);
                loadingProgress = xLogoProgress; // Update global progress for circle
                updateProgressCircle();

                if (xLogoProgress >= 100) {
                    clearInterval(xLogoLoadingInterval);
                    playXLogoAudio();
                }
            }, interval);
        });

        xLogo.addEventListener('mouseleave', () => {
            if (xLogoLoadingInterval) clearInterval(xLogoLoadingInterval);
            
            const duration = 500;
            const interval = 50;
            const steps = duration / interval;
            const decrement = xLogoProgress / steps;

            xLogoLoadingInterval = setInterval(() => {
                xLogoProgress = Math.max(0, xLogoProgress - decrement);
                loadingProgress = xLogoProgress;
                updateProgressCircle();

                if (xLogoProgress <= 0) {
                    clearInterval(xLogoLoadingInterval);
                    circularProgress.style.display = 'none';
                }
            }, interval);
        });
    }
}

// Add creepy mode toggle function
function toggleCreepyMode() {
    const creepyButton = document.getElementById('creepy-button');
    const endFrame = document.getElementById('end-frame');
    const videos = document.querySelectorAll('.video-container');
    const backgroundMusic = document.getElementById('background-music');
    
    if (!isCreepyMode) {
        // Start creepy mode
        isCreepyMode = true;
        creepyButton.classList.add('active');
        creepyStartTime = Date.now();

        // Store original camera position
        originalCameraZ = camera.position.z;

        // Store original light settings
        originalLights = scene.children
            .filter(child => child instanceof THREE.Light)
            .map(light => ({
                color: light.color.clone(),
                intensity: light.intensity
            }));

        // Store original scale
        originalScale = model.scale.x;

        // Play all creepy audio tracks
        creepyAudio.currentTime = 0;
        creepyAudio2.currentTime = 0;
        releaseMeAudio.currentTime = 0;
        creepyAudio.play();
        creepyAudio2.play();
        releaseMeAudio.play();

        // Fade in creepyAudio2 and releaseMeAudio, fade out background music
        const fadeInDuration = 1000; // 1 second
        const fadeStartTime = Date.now();

        function updateAudioFade() {
            const elapsed = Date.now() - fadeStartTime;
            const progress = Math.min(elapsed / fadeInDuration, 1);

            // Fade in creepyAudio2 and releaseMeAudio
            creepyAudio2.volume = progress;
            releaseMeAudio.volume = progress * 1; // Slightly lower volume for voice

            // Fade down background music to 20% volume
            if (backgroundMusic) {
                backgroundMusic.volume = 0.3 * (1 - progress * 0.8);
            }

            if (progress < 1) {
                requestAnimationFrame(updateAudioFade);
            }
        }

        updateAudioFade();

        // Dim the end frame and videos with transition
        endFrame.style.filter = 'brightness(0.3)';
        endFrame.style.transition = 'filter 2s ease';

        // Add creepy effect to videos
        videos.forEach(video => {
            video.style.transition = 'all 2s ease';
            video.style.filter = 'brightness(0.3) sepia(50%) hue-rotate(300deg)';
            video.style.transform += ' scale(0.95)';
        });

        // Gradually change model color to red
        if (model) {
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Store original color if not already stored
                    if (!child.userData.originalColor) {
                        child.userData.originalColor = child.material.color.clone();
                    }
                    
                    // Create transition for color
                    const startColor = child.material.color.clone();
                    const targetColor = new THREE.Color(0xff0000);
                    const startTime = Date.now();
                    const duration = 2000; // 2 seconds

                    function updateColor() {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        child.material.color.lerpColors(startColor, targetColor, progress);

                        if (progress < 1) {
                            requestAnimationFrame(updateColor);
                        }
                    }

                    updateColor();
                }
            });
        }

        // Change lights to red with transition
        scene.children.forEach(child => {
            if (child instanceof THREE.Light) {
                const startColor = child.color.clone();
                const targetColor = new THREE.Color(0xff0000);
                const startIntensity = child.intensity;
                const targetIntensity = startIntensity * 1.5;
                const startTime = Date.now();
                const duration = 2000; // 2 seconds

                function updateLight() {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    child.color.lerpColors(startColor, targetColor, progress);
                    child.intensity = startIntensity + (targetIntensity - startIntensity) * progress;

                    if (progress < 1) {
                        requestAnimationFrame(updateLight);
                    }
                }

                updateLight();
            }
        });

        // Modify creepy animation to handle audio fade out and camera zoom
        creepyInterval = setInterval(() => {
            const elapsed = Date.now() - creepyStartTime;
            const progress = Math.min(elapsed / CREEPY_DURATION, 1);

            // Existing animation code
            const newScale = originalScale * (1 + progress * 0.5);
            model.scale.set(newScale, newScale, newScale);

            // Add camera zoom
            const targetZ = originalCameraZ * 0.6; // Zoom in to 60% of original distance
            camera.position.z = originalCameraZ - (originalCameraZ - targetZ) * progress;

            if (neckBone) {
                const rotationSpeed = progress * 10;
                neckBone.rotation.y += Math.sin(Date.now() * 0.005) * 0.1 * rotationSpeed;
                neckBone.rotation.z += Math.cos(Date.now() * 0.003) * 0.1 * rotationSpeed;
                neckBone.rotation.x += Math.sin(Date.now() * 0.004) * 0.1 * rotationSpeed;
            }

            // Start fading out audio near the end
            if (progress > 0.8) {
                const fadeOutProgress = (progress - 0.8) * 5;
                creepyAudio.volume = 1 - fadeOutProgress;
                creepyAudio2.volume = 1 - fadeOutProgress;
                releaseMeAudio.volume = 1 * (1 - fadeOutProgress);
            }

            // Reset after duration
            if (progress >= 1) {
                resetCreepyMode();
            }
        }, 16);

    } else {
        resetCreepyMode();
    }
}

// Update reset function to handle new audio effects
function resetCreepyMode() {
    isCreepyMode = false;
    clearInterval(creepyInterval);
    
    const creepyButton = document.getElementById('creepy-button');
    const endFrame = document.getElementById('end-frame');
    const videos = document.querySelectorAll('.video-container');
    const backgroundMusic = document.getElementById('background-music');
    
    creepyButton.classList.remove('active');
    
    // Add camera zoom out animation
    const startCameraZ = camera.position.z;
    const startTime = Date.now();
    const duration = 2000; // 2 seconds

    function updateCameraZoom() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        camera.position.z = startCameraZ + (originalCameraZ - startCameraZ) * progress;

        if (progress < 1) {
            requestAnimationFrame(updateCameraZoom);
        }
    }

    updateCameraZoom();
    
    // Fade background music back up
    const fadeInDuration = 2000; // 2 seconds
    const fadeStartTime = Date.now();

    function updateMusicFade() {
        const elapsed = Date.now() - fadeStartTime;
        const progress = Math.min(elapsed / fadeInDuration, 1);

        if (backgroundMusic) {
            backgroundMusic.volume = 0.06 + (0.24 * progress); // Fade from 6% back to 30%
        }

        if (progress < 1) {
            requestAnimationFrame(updateMusicFade);
        }
    }

    updateMusicFade();

    // Reset lights with transition
    scene.children.forEach((child, index) => {
        if (child instanceof THREE.Light && originalLights[index]) {
            const startColor = child.color.clone();
            const targetColor = originalLights[index].color;
            const startIntensity = child.intensity;
            const targetIntensity = originalLights[index].intensity;
            const startTime = Date.now();
            const duration = 2000; // 2 seconds

            function updateLight() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                child.color.lerpColors(startColor, targetColor, progress);
                child.intensity = startIntensity + (targetIntensity - startIntensity) * progress;

                if (progress < 1) {
                    requestAnimationFrame(updateLight);
                }
            }

            updateLight();
        }
    });
    
    // Reset model color and scale
    if (model) {
        model.traverse((child) => {
            if (child.isMesh && child.material && child.userData.originalColor) {
                const startColor = child.material.color.clone();
                const targetColor = child.userData.originalColor;
                const startTime = Date.now();
                const duration = 2000; // 2 seconds

                function updateColor() {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    child.material.color.lerpColors(startColor, targetColor, progress);

                    if (progress < 1) {
                        requestAnimationFrame(updateColor);
                    }
                }

                updateColor();
            }
        });
        
        model.scale.set(originalScale, originalScale, originalScale);
    }
    
    // Reset neck bone rotation
    if (neckBone) {
        neckBone.rotation.set(0, 0, 0);
    }
    
    // Reset end frame and videos
    endFrame.style.filter = 'none';
    videos.forEach(video => {
        video.style.filter = 'none';
        video.style.transform = video.style.transform.replace(' scale(0.95)', '');
    });
    
    // Update audio fade out
    if (creepyAudio) {
        const fadeAudio = setInterval(() => {
            if (creepyAudio.volume > 0.1) {
                creepyAudio.volume -= 0.1;
                creepyAudio2.volume -= 0.1;
                releaseMeAudio.volume -= 0.1; // Proportional to its max volume
            } else {
                creepyAudio.pause();
                creepyAudio2.pause();
                releaseMeAudio.pause();
                creepyAudio.volume = 1;
                creepyAudio2.volume = 0;
                releaseMeAudio.volume = 0;
                clearInterval(fadeAudio);
            }
        }, 100);
    }
}

// Start the application
init();
animate(); 