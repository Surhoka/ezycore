const registerHotspotStudio = () => {
    if (window.Alpine && !window.Alpine.data('hotspotStudio')) {
        window.Alpine.data('hotspotStudio', () => ({
            activeTab: 'list',
            isLoading: false,
            projects: [],
            project: { id: null, title: '', lastModified: Date.now() },
            hotspots: [],
            imageUrl: null,
            selectedId: null,
            tool: 'select', // 'select', 'point', 'polygon', 'hand'
            scale: 1,
            pan: { x: 0, y: 0 },
            isPanning: false,
            lastMouse: { x: 0, y: 0 },
            isDraggingHotspot: false,
            draggedHotspotId: null,
            draggedPolygonPointIndex: null,
            isDrawing: false,
            isUploadingImage: false,
            pendingImageData: null,
            pendingFileName: null,
            history: [],
            historyIndex: -1,

            init() {
                console.log("Hotspot Studio Initialized");
                this.fetchProjects();
            },

            fetchProjects() {
                this.isLoading = true;
                window.sendDataToGoogle('getHotspotProjects', {}, (response) => {
                    this.isLoading = false;
                    if (response.status === 'success') {
                        this.projects = response.data || [];
                    } else {
                        window.showToast('Failed to load projects: ' + response.message, 'error');
                    }
                }, (error) => {
                    this.isLoading = false;
                    window.showToast('API Error loading projects', 'error');
                });
            },

            addToHistory() {
                const state = JSON.stringify({
                    hotspots: this.hotspots,
                    selectedId: this.selectedId,
                    isDrawing: this.isDrawing
                });
                if (this.historyIndex >= 0 && this.history[this.historyIndex] === state) return;
                if (this.historyIndex < this.history.length - 1) {
                    this.history = this.history.slice(0, this.historyIndex + 1);
                }
                this.history.push(state);
                this.historyIndex++;
            },

            undo() {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    const state = JSON.parse(this.history[this.historyIndex]);
                    this.hotspots = state.hotspots;
                    this.selectedId = state.selectedId;
                    this.isDrawing = state.isDrawing;
                }
            },

            redo() {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    const state = JSON.parse(this.history[this.historyIndex]);
                    this.hotspots = state.hotspots;
                    this.selectedId = state.selectedId;
                    this.isDrawing = state.isDrawing;
                }
            },

            handleImageUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imageUrl = e.target.result; // Local preview
                    this.pendingImageData = e.target.result; // Store for later upload
                    this.pendingFileName = file.name; // Capture original filename
                    this.hotspots = [];
                    this.selectedId = null;
                    this.resetView();
                    this.history = [];
                    this.historyIndex = -1;
                    this.addToHistory();
                };
                reader.readAsDataURL(file);
            },

            newProject() {
                this.project = { id: null, title: '', lastModified: Date.now() };
                this.hotspots = [];
                this.imageUrl = null;
                this.pendingImageData = null;
                this.pendingFileName = null;
                this.resetView();
                this.activeTab = 'studio';
                this.history = [];
                this.historyIndex = -1;
                this.addToHistory();
            },

            editProject(p) {
                // Clone to avoid direct mutation of list item until saved
                this.project = JSON.parse(JSON.stringify(p));
                this.hotspots = (p.hotspots || []).map(h => ({ animation: 'none', animationSize: 'md', ...h }));
                this.imageUrl = p.imageUrl || null;
                this.pendingImageData = null;
                this.pendingFileName = null;
                this.resetView();
                this.activeTab = 'studio';
                this.history = [];
                this.historyIndex = -1;
                this.addToHistory();
            },

            cancelEdit() {
                this.project = { id: null, title: '', lastModified: Date.now() };
                this.hotspots = [];
                this.imageUrl = null;
                this.pendingImageData = null;
                this.pendingFileName = null;
                this.resetView();
                this.activeTab = 'list';
                this.history = [];
                this.historyIndex = -1;
            },

            getCenter(spot) {
                if (spot.type !== 'polygon' || !spot.points || spot.points.length === 0) {
                    return { x: spot.x, y: spot.y };
                }
                const sumX = spot.points.reduce((acc, p) => acc + p.x, 0);
                const sumY = spot.points.reduce((acc, p) => acc + p.y, 0);
                return {
                    x: sumX / spot.points.length,
                    y: sumY / spot.points.length
                };
            },

            deleteProject(id) {
                if (confirm('Delete this project?')) {
                    window.sendDataToGoogle('deleteHotspotProject', { id: id }, (response) => {
                        if (response.status === 'success') {
                            window.showToast('Project deleted', 'success');
                            this.fetchProjects();
                        } else {
                            window.showToast('Delete failed: ' + response.message, 'error');
                        }
                    });
                }
            },

            setTool(t) {
                this.tool = t;
                if (t === 'select') {
                    this.isDrawing = false;
                }
            },

            handleCanvasClick(event) {
                if (!this.imageUrl) return;

                const rect = event.target.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 100;
                const y = ((event.clientY - rect.top) / rect.height) * 100;

                if (this.tool === 'polygon' || (this.isDrawing && this.selectedId)) {
                    this.addPolygonPoint(x, y);
                } else if (this.tool === 'point') {
                    this.addHotspot(x, y);
                } else if (this.tool === 'hand') {
                    // Do nothing for clicks in hand mode
                } else {
                    this.selectedId = null;
                    this.isDrawing = false;
                }
            },

            addHotspot(x, y) {
                const id = Date.now();
                this.hotspots.push({
                    id,
                    x,
                    y,
                    type: 'point',
                    animation: 'none',
                    animationSize: 'md',
                    title: '',
                    description: '',
                    url: ''
                });
                this.selectedId = id;
                this.tool = 'select'; // Switch back to select after adding
                this.addToHistory();
            },

            convertToPolygon() {
                const spot = this.getSelectedHotspot();
                if (spot) {
                    spot.type = 'polygon';
                    spot.points = [];
                    if (spot.x !== undefined && spot.y !== undefined) {
                        spot.points.push({ x: spot.x, y: spot.y });
                    }
                    this.isDrawing = true;
                    this.addToHistory();
                }
            },

            toggleDrawing() {
                this.isDrawing = !this.isDrawing;
            },

            addPolygonPoint(x, y) {
                let spot;
                if (this.selectedId) {
                    spot = this.hotspots.find(h => h.id === this.selectedId);
                }

                if (this.tool === 'polygon' && (!spot || spot.type !== 'polygon')) {
                    const id = Date.now();
                    spot = { id, x, y, title: 'New Area', type: 'polygon', animation: 'none', animationSize: 'md', points: [], description: '', url: '' };
                    this.hotspots.push(spot);
                    this.selectedId = id;
                    this.isDrawing = true;
                }

                if (spot && spot.type === 'polygon') {
                    if (!spot.points) spot.points = [];
                    spot.points.push({ x, y });
                }
                this.addToHistory();
            },

            removePolygonPoint(index) {
                const spot = this.getSelectedHotspot();
                if (spot && spot.type === 'polygon' && spot.points) {
                    spot.points.splice(index, 1);
                    this.addToHistory();
                }
            },

            selectHotspot(id, toggle = false) {
                if (toggle && this.selectedId === id) {
                    this.selectedId = null;
                } else {
                    this.selectedId = id;
                }
            },

            getSelectedHotspot() {
                return this.hotspots.find(h => h.id === this.selectedId);
            },

            deleteHotspot(id) {
                this.hotspots = this.hotspots.filter(h => h.id !== id);
                if (this.selectedId === id) this.selectedId = null;
                this.addToHistory();
            },

            // Zoom & Pan Logic
            zoomIn() {
                this.scale = Math.min(this.scale * 1.2, 5);
            },

            zoomOut() {
                this.scale = Math.max(this.scale / 1.2, 0.5);
            },

            resetView() {
                this.scale = 1;
                this.pan = { x: 0, y: 0 };
            },

            handleWheel(e) {
                if (e.ctrlKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    this.scale = Math.min(Math.max(this.scale * delta, 0.5), 5);
                } else {
                    // Optional: Pan on scroll
                }
            },

            startPan(e) {
                if ((this.tool === 'select' || this.tool === 'hand') && e.button === 0) { // Left click pan if in select or hand mode
                    this.isPanning = true;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                }
            },

            startDragHotspot(e, id, pointIndex = null) {
                // Allow dragging in relevant tool modes
                if (this.tool === 'hand') return;
                this.isDraggingHotspot = true;
                this.draggedHotspotId = id;
                this.draggedPolygonPointIndex = pointIndex;
                this.selectHotspot(id);
            },

            handleMouseMove(e) {
                if (this.isDraggingHotspot && this.draggedHotspotId && this.imageUrl) {
                    const img = this.$refs.img;
                    if (!img) return;

                    const rect = img.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;

                    // Clamp values between 0 and 100
                    const clampedX = Math.max(0, Math.min(100, x));
                    const clampedY = Math.max(0, Math.min(100, y));

                    const hotspot = this.hotspots.find(h => h.id === this.draggedHotspotId);
                    if (hotspot) {
                        if (this.draggedPolygonPointIndex !== null && hotspot.type === 'polygon') {
                            if (hotspot.points && hotspot.points[this.draggedPolygonPointIndex]) {
                                hotspot.points[this.draggedPolygonPointIndex].x = clampedX;
                                hotspot.points[this.draggedPolygonPointIndex].y = clampedY;
                            }
                        } else {
                            hotspot.x = clampedX;
                            hotspot.y = clampedY;
                        }
                    }
                } else if (this.isPanning) {
                    const dx = e.clientX - this.lastMouse.x;
                    const dy = e.clientY - this.lastMouse.y;
                    this.pan.x += dx;
                    this.pan.y += dy;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                }
            },

            endPan() {
                if (this.isDraggingHotspot) {
                    this.addToHistory();
                }
                this.isPanning = false;
                this.isDraggingHotspot = false;
                this.draggedHotspotId = null;
                this.draggedPolygonPointIndex = null;
            },

            saveProject(button) {
                if (!this.project.title) {
                    window.showToast('Project title is required', 'warning');
                    return;
                }

                if (button) window.setButtonLoading(button, true);

                // Check if there is a pending image to upload first
                if (this.pendingImageData) {
                    this.isUploadingImage = true;
                    const fileName = this.pendingFileName || `hotspot_${Date.now()}.png`;

                    window.sendDataToGoogle('uploadImageAndGetUrl', {
                        fileData: this.pendingImageData,
                        fileName: fileName
                    }, (response) => {
                        this.isUploadingImage = false;
                        if (response.status === 'success') {
                            this.imageUrl = response.url;
                            this.pendingImageData = null; // Clear pending data
                            this.executeSave(button); // Proceed with project save
                        } else {
                            if (button) window.setButtonLoading(button, false);
                            window.showToast('Failed to upload image: ' + response.message, 'error');
                        }
                    }, (error) => {
                        this.isUploadingImage = false;
                        if (button) window.setButtonLoading(button, false);
                        window.showToast('API Error during image upload', 'error');
                    });
                } else {
                    this.executeSave(button);
                }
            },

            executeSave(button) {
                const payload = {
                    id: this.project.id,
                    title: this.project.title,
                    imageUrl: this.imageUrl,
                    hotspots: this.hotspots
                };

                window.sendDataToGoogle('saveHotspotProject', payload, (response) => {
                    if (button) window.setButtonLoading(button, false);
                    if (response.status === 'success') {
                        window.showToast(response.message || 'Project saved!', 'success');
                        this.activeTab = 'list';
                        this.fetchProjects();
                    } else {
                        window.showToast('Save failed: ' + response.message, 'error');
                    }
                }, (error) => {
                    if (button) window.setButtonLoading(button, false);
                    window.showToast('API Error saving project', 'error');
                });
            },

            exportCode() {
                const data = JSON.stringify({
                    image: this.imageUrl ? 'image_url_here' : null,
                    hotspots: this.hotspots
                }, null, 2);
                console.log(data);
                alert('Check console for JSON output');
            }
        }));
    }
};

if (window.Alpine) {
    registerHotspotStudio();
} else {
    document.addEventListener('alpine:init', registerHotspotStudio);
}
