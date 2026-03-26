let renderer, scene, camera, animId;
let modelGroup = null, edgesGroup = null, wireGroup = null, gridHelper;
let baseMaterial, currentColor = 0x2d6a9f;
let measureMode = false, measurePts = [], measureMarkers = [];
let measureLine = null;
let isOrbit = false, isPan = false;
let orbitLast = {x:0,y:0}, camSphere = {r:500, theta:0.8, phi:1.0};
let camTarget = new THREE.Vector3(0,0,0);
let modelBounds = null;

// ── Init renderer on first use ──
function initRenderer() {
  if (renderer) return true;
  const wrap = document.getElementById('p3_canvas_wrap');
  if (!wrap || !window.THREE) return false;

  const W = wrap.clientWidth || 900, H = wrap.clientHeight || 600;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Insert canvas
  const existing = wrap.querySelector('canvas');
  if (existing) existing.remove();
  wrap.insertBefore(renderer.domElement, wrap.firstChild);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0';

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050a12);
  scene.fog = new THREE.Fog(0x050a12, 1500, 4000);

  // Camera
  camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 10000);
  updateCamera();

  // Lights — studio quality
  const ambient = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(300, 500, 400);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 3000;
  key.shadow.camera.left = key.shadow.camera.bottom = -600;
  key.shadow.camera.right = key.shadow.camera.top = 600;
  key.shadow.bias = -0.0003;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8899cc, 0.5);
  fill.position.set(-200, 200, -300);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x00d4aa, 0.3);
  rim.position.set(0, -100, -200);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0x334466, 0x111122, 0.4);
  scene.add(hemi);

  // Grid
  gridHelper = new THREE.GridHelper(2000, 50, 0x0d1829, 0x0a1420);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Shadow receiver plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.ShadowMaterial({ opacity: 0.35, transparent: true })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Events
  const el = renderer.domElement;
  el.addEventListener('mousedown',   onDown);
  el.addEventListener('mousemove',   onMove);
  el.addEventListener('mouseup',     onUp);
  el.addEventListener('mouseleave',  onUp);
  el.addEventListener('wheel',       onWheel, {passive:false});
  el.addEventListener('click',       onClickMeasure);
  el.addEventListener('contextmenu', e => e.preventDefault());

  // Drag-drop upload
  const canvasWrap = document.getElementById('p3_canvas_wrap');
  canvasWrap.addEventListener('dragover', e => { e.preventDefault(); canvasWrap.style.borderColor='rgba(0,212,170,.8)'; });
  canvasWrap.addEventListener('dragleave',()=> canvasWrap.style.borderColor='');
  canvasWrap.addEventListener('drop', e => {
    e.preventDefault(); canvasWrap.style.borderColor='';
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  window.addEventListener('resize', onResize);

  // Animate
  function animate() {
    animId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  return true;
}

// ── Camera math ──
function updateCamera() {
  if (!camera) return;
  const x = camSphere.r * Math.sin(camSphere.phi) * Math.sin(camSphere.theta);
  const y = camSphere.r * Math.cos(camSphere.phi);
  const z = camSphere.r * Math.sin(camSphere.phi) * Math.cos(camSphere.theta);
  camera.position.set(
    camTarget.x + x,
    camTarget.y + y,
    camTarget.z + z
  );
  camera.lookAt(camTarget);
}

// ── Mouse orbit/pan ──
function onDown(e) {
  if (e.button === 0) isOrbit = true;
  if (e.button === 1 || e.button === 2) isPan = true;
  orbitLast = {x: e.clientX, y: e.clientY};
  renderer.domElement.style.cursor = 'grabbing';
}
function onUp() {
  isOrbit = isPan = false;
  renderer.domElement.style.cursor = measureMode ? 'crosshair' : 'grab';
}
function onMove(e) {
  const dx = e.clientX - orbitLast.x;
  const dy = e.clientY - orbitLast.y;
  orbitLast = {x: e.clientX, y: e.clientY};

  if (isOrbit && !measureMode) {
    camSphere.theta -= dx * 0.007;
    camSphere.phi    = Math.max(0.05, Math.min(Math.PI * 0.95, camSphere.phi - dy * 0.007));
    updateCamera();
  }
  if (isPan) {
    // Pan perpendicular to view
    const right = new THREE.Vector3();
    right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
    const up = camera.up.clone().normalize();
    const panScale = camSphere.r * 0.001;
    camTarget.addScaledVector(right, -dx * panScale);
    camTarget.addScaledVector(up,  dy * panScale);
    updateCamera();
  }

  // Show coords in bottom-left
  updateCoords(e);
}
function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.12 : 0.89;
  camSphere.r = Math.max(5, Math.min(5000, camSphere.r * factor));
  updateCamera();
}

function updateCoords(e) {
  if (!modelGroup) return;
  const wrap = document.getElementById('p3_canvas_wrap');
  const rect = wrap.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
  const hits = raycaster.intersectObjects([modelGroup], true);
  const el = document.getElementById('p3_coords');
  if (!el) return;
  if (hits.length) {
    const p = hits[0].point;
    el.style.display = 'block';
    el.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
  } else {
    el.style.display = 'none';
  }
}

function onResize() {
  if (!renderer) return;
  const wrap = document.getElementById('p3_canvas_wrap');
  if (!wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ── FILE LOADING ──
window.p3_loadFile = function(input) {
  const file = input?.files?.[0];
  if (file) processFile(file);
};

function processFile(file) {
  const name = file.name.toLowerCase();
  document.getElementById('p3_empty').style.display = 'none';
  setLoading(true);
  document.getElementById('p3_file_info').textContent = `Loading: ${file.name}`;

  if (name.endsWith('.stl')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const geo = parseSTL(e.target.result);
        loadGeometry(geo, file.name);
      } catch(err) {
        showError('STL parse error: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (name.endsWith('.obj')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const geo = parseOBJ(e.target.result);
        loadGeometry(geo, file.name);
      } catch(err) {
        showError('OBJ parse error: ' + err.message);
      }
    };
    reader.readAsText(file);
  } else if (name.endsWith('.gltf') || name.endsWith('.glb')) {
    const reader = new FileReader();
    reader.onload = e => {
      loadGLTF(e.target.result, file.name, name.endsWith('.glb'));
    };
    reader.readAsArrayBuffer(file);
  } else {
    showError('Unsupported format. Use STL, OBJ, or GLTF/GLB.');
    setLoading(false);
  }
}

// ── STL PARSER ──
function parseSTL(buffer) {
  const dv = new DataView(buffer);
  // Check binary: first 80 bytes are header, then uint32 triangle count
  const isBinary = (() => {
    // ASCII STL starts with "solid"
    const head = new Uint8Array(buffer, 0, 5);
    const isAscii = head[0]===115&&head[1]===111&&head[2]===108&&head[3]===105&&head[4]===100;
    if (!isAscii) return true;
    // Could still be binary starting with "solid" - check size
    const triCount = dv.getUint32(80, true);
    const expectedSize = 84 + triCount * 50;
    return Math.abs(expectedSize - buffer.byteLength) < 100;
  })();

  if (isBinary) {
    const triCount = dv.getUint32(80, true);
    const verts = new Float32Array(triCount * 9);
    const norms = new Float32Array(triCount * 9);
    let off = 84;
    for (let i = 0; i < triCount; i++) {
      const nx = dv.getFloat32(off,true), ny = dv.getFloat32(off+4,true), nz = dv.getFloat32(off+8,true);
      off += 12;
      for (let v = 0; v < 3; v++) {
        const vi = i*9 + v*3;
        verts[vi]   = dv.getFloat32(off,true);
        verts[vi+1] = dv.getFloat32(off+4,true);
        verts[vi+2] = dv.getFloat32(off+8,true);
        norms[vi] = nx; norms[vi+1] = ny; norms[vi+2] = nz;
        off += 12;
      }
      off += 2; // attribute byte count
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(norms, 3));
    return geo;
  } else {
    // ASCII STL
    const text = new TextDecoder().decode(buffer);
    const positions = [];
    const re = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      positions.push(+m[1], +m[2], +m[3]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.computeVertexNormals();
    return geo;
  }
}

// ── OBJ PARSER ──
function parseOBJ(text) {
  const verts = [], positions = [], normals_raw = [], normals_out = [];
  const lines = text.split('\n');
  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v')  verts.push(+parts[1], +parts[2], +parts[3]);
    if (parts[0] === 'f') {
      // Triangulate (simple fan)
      const indices = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
      for (let i = 1; i < indices.length - 1; i++) {
        [0, i, i+1].forEach(j => {
          const vi = indices[j] * 3;
          positions.push(verts[vi], verts[vi+1], verts[vi+2]);
        });
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  return geo;
}

// ── GLTF / GLB LOADER ── (inline micro-parser for GLB)
function loadGLTF(buffer, filename, isGLB) {
  // For GLTF/GLB use Three.js GLTFLoader from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/loaders/GLTFLoader.js';
  script.onload = () => {
    const loader = new THREE.GLTFLoader();
    const blob = new Blob([buffer], {type: isGLB ? 'model/gltf-binary' : 'model/gltf+json'});
    const url = URL.createObjectURL(blob);
    loader.load(url, gltf => {
      URL.revokeObjectURL(url);
      clearModel();
      if (!initRenderer()) return;
      modelGroup = gltf.scene;
      scene.add(modelGroup);
      fitModel();
      updateInfo(filename, modelGroup);
      setLoading(false);
    }, null, err => showError('GLTF error: ' + err));
  };
  script.onerror = () => showError('Could not load GLTF loader. Try STL or OBJ format.');
  document.head.appendChild(script);
}

// ── LOAD GEOMETRY into scene ──
function loadGeometry(geo, filename) {
  clearModel();
  if (!initRenderer()) { showError('Three.js not available yet. Please wait and try again.'); return; }

  geo.computeBoundingBox();
  geo.computeVertexNormals();

  // Centre geometry
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  const centre = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Scale to reasonable size (200 units max)
  const scale = maxDim > 0 ? 200 / maxDim : 1;
  geo.translate(-centre.x, -centre.y, -centre.z);
  geo.scale(scale, scale, scale);
  geo.computeBoundingBox();

  const finalBox  = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const finalCentre = finalBox.getCenter(new THREE.Vector3());

  // Move so bottom sits on grid (y=0)
  geo.translate(0, -finalBox.min.y, 0);

  modelBounds = { size: finalSize, maxDim: Math.max(finalSize.x, finalSize.y, finalSize.z), scale };

  // Main mesh material
  baseMaterial = new THREE.MeshStandardMaterial({
    color:     currentColor,
    roughness: 0.45,
    metalness: 0.55,
    side:      THREE.DoubleSide,
    envMapIntensity: 0.8,
  });

  const mesh = new THREE.Mesh(geo, baseMaterial);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;

  modelGroup = new THREE.Group();
  modelGroup.add(mesh);
  scene.add(modelGroup);

  // Edge lines
  const edgeGeo = new THREE.EdgesGeometry(geo, 20); // 20° threshold
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d4aa, transparent: true, opacity: 0.4, linewidth: 1 });
  edgesGroup = new THREE.LineSegments(edgeGeo, edgeMat);
  scene.add(edgesGroup);

  // Fit camera
  fitModel();

  // Info
  const triCount = Math.floor(geo.attributes.position.count / 3);
  updateInfo(filename, null, triCount, finalSize, scale);
  setLoading(false);
  document.getElementById('p3_empty').style.display = 'none';
  setStatus('✅ Loaded: ' + filename);
}

// ── FIT CAMERA to model ──
function fitModel() {
  if (!modelBounds) return;
  camSphere.r = modelBounds.maxDim * 2.5;
  camSphere.theta = 0.8;
  camSphere.phi   = 1.05;
  camTarget.set(0, modelBounds.size.y * 0.5, 0);
  updateCamera();

  // Lower grid to bottom of model
  if (gridHelper) gridHelper.position.y = -0.5;
}

// ── DEMO MODELS (procedural geometry) ──
window.p3_loadDemo = function(type) {
  let geo;
  if (type === 'box') {
    // Realistic battery pack box — 500×200×150mm proportional
    geo = new THREE.BoxGeometry(1, 0.4, 0.6, 4, 2, 2);
    // Add some detail: bevelled edges via merge
    currentColor = 0x1a3a5c;
  } else if (type === 'pouch') {
    // Pouch cell stack
    const group_geo_parts = [];
    for (let i = 0; i < 8; i++) {
      const cell = new THREE.BoxGeometry(0.85, 0.04, 0.55);
      cell.translate(0, -0.15 + i * 0.046, 0);
      group_geo_parts.push(cell);
    }
    // Merge all cells
    geo = mergeGeometries(group_geo_parts);
    currentColor = 0x2d5a8e;
  } else if (type === 'module') {
    // Battery module with cells + frame
    const parts = [];
    // Housing frame
    const frame = new THREE.BoxGeometry(1.0, 0.5, 0.7);
    parts.push(frame);
    // Cells inside
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = new THREE.BoxGeometry(0.18, 0.38, 0.52);
        cell.translate(-0.35 + c*0.22, 0, -0.04 + r*0.08);
        parts.push(cell);
      }
    }
    geo = mergeGeometries(parts);
    currentColor = 0x1a4a2a;
  }

  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const scale = 200 / Math.max(size.x, size.y, size.z);
  geo.scale(scale, scale, scale);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  loadGeometry(geo, `demo_${type}.stl (procedural)`);
};

function mergeGeometries(geos) {
  // Simple merge: concatenate position arrays
  let totalVerts = 0;
  geos.forEach(g => { totalVerts += g.attributes.position.count; });
  const positions = new Float32Array(totalVerts * 3);
  let offset = 0;
  geos.forEach(g => {
    positions.set(g.attributes.position.array, offset * 3);
    offset += g.attributes.position.count;
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

// ── CLEAR MODEL ──
function clearModel() {
  if (modelGroup) { scene.remove(modelGroup); modelGroup = null; }
  if (edgesGroup)  { scene.remove(edgesGroup);  edgesGroup = null; }
  if (wireGroup)   { scene.remove(wireGroup);   wireGroup = null; }
  clearMeasure();
}

// ── DISPLAY CONTROLS ──
window.p3_setWireframe = function(on) {
  if (!modelGroup) return;
  if (on) {
    if (!wireGroup) {
      modelGroup.traverse(child => {
        if (child.isMesh) {
          const wg = new THREE.WireframeGeometry(child.geometry);
          wireGroup = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({color:0x00d4aa, transparent:true, opacity:0.15}));
          scene.add(wireGroup);
        }
      });
    }
  } else {
    if (wireGroup) { scene.remove(wireGroup); wireGroup = null; }
  }
};
window.p3_setEdges  = function(on) { if(edgesGroup) edgesGroup.visible = on; };
window.p3_setGrid   = function(on) { if(gridHelper)  gridHelper.visible  = on; };
window.p3_setShadow = function(on) { if(renderer) renderer.shadowMap.enabled = on; };

window.p3_setColor  = function(hex) {
  currentColor = hex;
  if (baseMaterial) baseMaterial.color.setHex(hex);
};
window.p3_setOpacity = function(v) {
  if (baseMaterial) {
    baseMaterial.opacity = v;
    baseMaterial.transparent = v < 1;
  }
};

// ── CAMERA VIEWS ──
window.p3_view = function(preset) {
  if (!camera) { initRenderer(); }
  const views = {
    iso:    {theta:0.8,  phi:1.05},
    top:    {theta:0,    phi:0.01},
    front:  {theta:0,    phi:Math.PI/2},
    side:   {theta:Math.PI/2, phi:Math.PI/2},
    bottom: {theta:0,    phi:Math.PI*0.99},
  };
  const v = views[preset] || views.iso;
  camSphere.theta = v.theta;
  camSphere.phi   = v.phi;
  updateCamera();
};
window.p3_fitView      = fitModel;
window.p3_resetCamera  = function() { camSphere={r:500,theta:0.8,phi:1.0}; camTarget.set(0,0,0); updateCamera(); };

// ── MEASURE TOOL ──
function onClickMeasure(e) {
  if (!measureMode || !modelGroup) return;
  const wrap = document.getElementById('p3_canvas_wrap');
  const rect = wrap.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  const my = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
  const hits = raycaster.intersectObjects([modelGroup], true);
  if (!hits.length) return;

  const pt = hits[0].point.clone();
  measurePts.push(pt);

  // Marker sphere
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(modelBounds ? modelBounds.maxDim * 0.015 : 2, 10, 10),
    new THREE.MeshBasicMaterial({color: measurePts.length===1 ? 0xff4d6d : 0x00d4aa})
  );
  sphere.position.copy(pt);
  scene.add(sphere);
  measureMarkers.push(sphere);

  const out = document.getElementById('p3_meas_out');
  if (measurePts.length === 1) {
    if(out) out.innerHTML = `<span style="color:#4a9eff">Point 1 set</span><br><span style="color:var(--text3);font-size:11px">Click second point on model</span>`;
  }
  if (measurePts.length >= 2) {
    const p1 = measurePts[0], p2 = measurePts[1];
    const dist  = p1.distanceTo(p2);
    const dx    = Math.abs(p2.x-p1.x), dy = Math.abs(p2.y-p1.y), dz = Math.abs(p2.z-p1.z);

    // Draw line between points
    if (measureLine) scene.remove(measureLine);
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    measureLine = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0xf5c518, linewidth:2}));
    scene.add(measureLine);

    const scale = (modelBounds?.scale || 1);
    const realDist = dist / scale;
    if(out) out.innerHTML = `
      <div style="font-size:15px;font-weight:700;color:#00d4aa">📏 ${realDist.toFixed(2)} units</div>
      <div style="font-size:11px;color:#6d8fba;margin-top:4px">
        ΔX: ${(dx/scale).toFixed(2)} &nbsp; ΔY: ${(dy/scale).toFixed(2)} &nbsp; ΔZ: ${(dz/scale).toFixed(2)}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Click again to start new measurement</div>`;

    measurePts = [];
    measureMarkers = [];
    stopMeasure();
  }
}

function stopMeasure() {
  measureMode = false;
  document.getElementById('p3_crosshair').style.display = 'none';
  const btn = document.getElementById('p3_meas_btn');
  if(btn) { btn.textContent='📐 Start Measuring'; btn.style.background='rgba(59,130,246,.08)'; btn.style.borderColor='rgba(59,130,246,.3)'; }
  if (renderer) renderer.domElement.style.cursor = 'grab';
}

function clearMeasure() {
  measurePts = [];
  measureMarkers.forEach(m => scene && scene.remove(m));
  measureMarkers = [];
  if (measureLine) { scene && scene.remove(measureLine); measureLine = null; }
}

window.p3_toggleMeasure = function() {
  if (!modelGroup) { alert('Load a model first.'); return; }
  measureMode = !measureMode;
  clearMeasure();
  const btn = document.getElementById('p3_meas_btn');
  const ch  = document.getElementById('p3_crosshair');
  if (measureMode) {
    if(btn) { btn.textContent='✕ Cancel Measure'; btn.style.background='rgba(0,212,170,.15)'; btn.style.borderColor='rgba(0,212,170,.5)'; }
    if(ch)  ch.style.display = 'block';
    if(renderer) renderer.domElement.style.cursor = 'crosshair';
    document.getElementById('p3_meas_out').innerHTML = '<span style="color:#f5c518">Click first point on model surface</span>';
  } else {
    stopMeasure();
    document.getElementById('p3_meas_out').innerHTML = '';
  }
};

// ── UI HELPERS ──
function setLoading(on) {
  const el = document.getElementById('p3_loading');
  if(el) el.style.display = on ? 'flex' : 'none';
}
function setStatus(msg) {
  const el = document.getElementById('p3_toolbar_status');
  if(el) el.textContent = msg;
}
function showError(msg) {
  setLoading(false);
  setStatus('❌ ' + msg);
  document.getElementById('p3_file_info').textContent = '⚠ ' + msg;
  document.getElementById('p3_file_info').style.color = '#ff4d6d';
}
function updateInfo(filename, gltfScene, triCount, size, scale) {
  const el = document.getElementById('p3_info');
  if (!el) return;
  let html = `<b style="color:var(--g)">${filename}</b><br>`;
  if (triCount) html += `Triangles: ${triCount.toLocaleString()}<br>`;
  if (size) html += `Size: ${(size.x/scale).toFixed(1)} × ${(size.y/scale).toFixed(1)} × ${(size.z/scale).toFixed(1)}<br>`;
  if (scale && scale !== 1) html += `<span style="color:var(--text3)">Scaled ×${scale.toFixed(4)} for display</span>`;
  if (gltfScene) {
    let meshCount = 0, vertCount = 0;
    gltfScene.traverse(c => { if(c.isMesh) { meshCount++; vertCount += (c.geometry.attributes.position?.count||0); } });
    html += `Meshes: ${meshCount} &nbsp; Verts: ${vertCount.toLocaleString()}<br>`;
  }
  el.innerHTML = html;
  document.getElementById('p3_file_info').textContent = '✅ ' + filename;
  document.getElementById('p3_file_info').style.color = '#00d4aa';
}

// ── INIT on tab open ──
window.p3_init = function() {
  if (!initRenderer()) {
    // Three.js may still be loading
    setTimeout(() => { initRenderer(); }, 500);
  }
};

})();


// ════════════════════════════════════════════════════════
// DATA PERSISTENCE GUARD — submitted data never auto-reset
// ════════════════════════════════════════════════════════
let _dataSubmitted = false;   // true once user clicks Submit
let _frozenValues  = {};      // snapshot of submitted values

function submitAndLock() {
  // Save current state permanently
  _dataSubmitted = true;
  _frozenValues  = {};
  if (typeof SOURCE_FIELD_IDS !== 'undefined') {
    SOURCE_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) _frozenValues[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
  }
  // Persist to localStorage
  if (typeof saveProject === 'function') saveProject();
  // Visual feedback
  const btn = document.getElementById('global_submit_btn');
  if (btn) {
    btn.textContent = '✓ Saved — Data Locked';
    btn.style.background = 'var(--teal)';
    btn.style.color = '#000';
    setTimeout(() => {
      btn.textContent = '💾 Save & Lock Project';
      btn.style.background = '';
      btn.style.color = '';
    }, 3000);
  }
  // Show lock indicator
  const ind = document.getElementById('data_lock_indicator');
  if (ind) {
    ind.style.display = 'flex';
    ind.textContent = '🔒 Project data locked — click Reset to unlock';
  }
  if (typeof propagate === 'function') propagate();
}

function resetAndUnlock() {
  if (!confirm('⚠️ This will clear all submitted data and reset to defaults. Continue?')) return;
  _dataSubmitted = false;
  _frozenValues  = {};
  // Clear localStorage
  try {
    const key = typeof PERSIST_KEY !== 'undefined' ? PERSIST_KEY : 'battmis_v1';
    localStorage.removeItem(key);
  } catch(e) {}
  // Reset all fields to defaults by reloading
  window.location.reload();
}

// Base setField — writes value to DOM element without triggering oninput events
