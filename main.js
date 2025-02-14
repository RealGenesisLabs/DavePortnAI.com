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

        // Fade in the logo and contract address
        const pumpFunContainer = document.getElementById('pump-fun-container');
        if (pumpFunContainer) {
            pumpFunContainer.style.opacity = '1';
        }
    }, { once: true });
}

function showVideos() {
    const videos = document.querySelectorAll('.video-container');
    videoElements = Array.from(videos);

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
        let tweetText = "";
        switch (index) {
            case 0:
                tweetText = "Check out this awesome video 1! #video1";
                break;
            case 1:
                tweetText = "This is video 2, it's amazing! #video2";
                break;
            case 2:
                tweetText = "Video 3 is the best! #video3";
                break;
            case 3:
                tweetText = "Don't miss video 4! #video4";
                break;
            case 4:
                tweetText = "Video 5 is here! #video5";
                break;
            case 5:
                tweetText = "Finally, video 6! #video6";
                break;
            default: // Good practice to have a default
                tweetText = "Check out this cool 3D website!";
        }

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
                if (!pumpFunAudio.analysisSetup) {
                    setupAudioAnalysis(pumpFunAudio);
                    pumpFunAudio.analysisSetup = true;
                }
                // Only play if it's not already playing
                if (!isPumpFunAudioPlaying) {
                    pumpFunAudio.currentTime = 0;
                    pumpFunAudio.play();
                    isPumpFunAudioPlaying = true;

                    // Add ended event listener to reset the state
                    pumpFunAudio.addEventListener('ended', () => {
                        isPumpFunAudioPlaying = false;
                    }, { once: true });
                }
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

// Start the application
init();
animate(); 