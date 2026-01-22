<script setup>
import { ref, computed, watch } from "vue";
import { X, Upload, Move, ZoomIn, ZoomOut, RotateCw, Check } from "lucide-vue-next";

const props = defineProps({
  modelValue: {
    type: String,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "update:show"]);

const fileInput = ref(null);
const originalImageSrc = ref(null); // Store original uploaded image
const previewImageSrc = ref(null); // For preview display
const canvas = ref(null);
const container = ref(null);

// Crop state
const scale = ref(1);
const position = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const imageLoaded = ref(false);
const imageSize = ref({ width: 0, height: 0 });
const containerSize = ref({ width: 300, height: 300 });

const outputSize = 300; // Square output size

// Computed
const imageStyle = computed(() => {
  return {
    transform: `translate(calc(-50% + ${position.value.x}px), calc(-50% + ${position.value.y}px)) scale(${scale.value})`,
  };
});

// Watch for show prop
watch(() => props.show, (newVal) => {
  if (newVal && props.modelValue) {
    originalImageSrc.value = props.modelValue;
    previewImageSrc.value = props.modelValue;
    loadImage(props.modelValue);
  } else if (!newVal) {
    reset();
  }
});

// Watch for modelValue changes
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.show) {
    originalImageSrc.value = newVal;
    previewImageSrc.value = newVal;
    loadImage(newVal);
  }
});

// Load image
const loadImage = (src) => {
  const img = new Image();
  img.onload = () => {
    imageSize.value = { width: img.width, height: img.height };
    imageLoaded.value = true;
    // Update container size
    if (container.value) {
      const rect = container.value.getBoundingClientRect();
      containerSize.value = { width: rect.width, height: rect.width }; // Square
    }
    // Center image initially
    centerImage();
  };
  img.src = src;
};

// Center image
const centerImage = () => {
  const imgAspect = imageSize.value.width / imageSize.value.height;
  const containerAspect = containerSize.value.width / containerSize.value.height;
  
  let initialScale = 1;
  if (imgAspect > containerAspect) {
    initialScale = containerSize.value.height / imageSize.value.height;
  } else {
    initialScale = containerSize.value.width / imageSize.value.width;
  }
  
  scale.value = initialScale * 1.2; // Slightly larger to allow cropping
  position.value = { x: 0, y: 0 };
};

// Handle file selection
const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      originalImageSrc.value = e.target.result; // Store original
      previewImageSrc.value = e.target.result; // Use for preview
      loadImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }
};

// Mouse/Touch handlers
const startDrag = (e) => {
  if (!imageLoaded.value) return;
  isDragging.value = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragStart.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y,
  };
};

const drag = (e) => {
  if (!isDragging.value || !imageLoaded.value) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  position.value = {
    x: clientX - dragStart.value.x,
    y: clientY - dragStart.value.y,
  };
};

const endDrag = () => {
  isDragging.value = false;
};

// Zoom
const zoom = (delta) => {
  if (!imageLoaded.value) return;
  const newScale = Math.max(0.5, Math.min(3, scale.value + delta));
  scale.value = newScale;
};

// Rotate (90 degrees)
const rotate = () => {
  if (!imageLoaded.value) return;
  // Swap width/height
  const temp = imageSize.value.width;
  imageSize.value.width = imageSize.value.height;
  imageSize.value.height = temp;
  centerImage();
};

// Crop and convert to base64
const cropImage = () => {
  if (!canvas.value || !originalImageSrc.value || !imageLoaded.value) return;
  
  const ctx = canvas.value.getContext('2d');
  const img = new Image();
  
  // Always use the original image for cropping
  img.onload = () => {
    // The image is positioned with transform: translate(x, y) scale(scale)
    // The container is centered, so the image origin is at (width/2, height/2) before transform
    
    // Calculate the scale factor from container to image
    const scaleToImage = 1 / scale.value;
    
    // The container center in container coordinates
    const containerCenterX = containerSize.value.width / 2;
    const containerCenterY = containerSize.value.height / 2;
    
    // The visible crop area center in container coordinates (accounting for position offset)
    const cropCenterX = containerCenterX - position.value.x;
    const cropCenterY = containerCenterY - position.value.y;
    
    // Convert to image coordinates
    const imageCenterX = img.width / 2;
    const imageCenterY = img.height / 2;
    
    // Calculate the crop area size in image coordinates
    const cropSizeInImage = containerSize.value.width * scaleToImage;
    
    // Calculate source coordinates (top-left corner of crop area)
    const sourceX = imageCenterX - cropSizeInImage / 2 - (position.value.x * scaleToImage);
    const sourceY = imageCenterY - cropSizeInImage / 2 - (position.value.y * scaleToImage);
    
    // Ensure we don't go outside image bounds
    const finalSourceX = Math.max(0, Math.min(img.width - cropSizeInImage, sourceX));
    const finalSourceY = Math.max(0, Math.min(img.height - cropSizeInImage, sourceY));
    const finalCropSize = Math.min(
      cropSizeInImage,
      img.width - finalSourceX,
      img.height - finalSourceY
    );
    
    // Draw cropped image to canvas
    canvas.value.width = outputSize;
    canvas.value.height = outputSize;
    
    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);
    
    // Draw the cropped portion from ORIGINAL image, scaled to output size
    ctx.drawImage(
      img,
      finalSourceX, finalSourceY, finalCropSize, finalCropSize,
      0, 0, outputSize, outputSize
    );
    
    // Create circular mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Convert to base64
    const base64 = canvas.value.toDataURL('image/png', 1.0);
    emit('update:modelValue', base64);
    emit('update:show', false);
  };
  
  // Always use original image for cropping
  img.src = originalImageSrc.value;
};

// Reset
const reset = () => {
  originalImageSrc.value = null;
  previewImageSrc.value = null;
  imageLoaded.value = false;
  scale.value = 1;
  position.value = { x: 0, y: 0 };
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// Close
const close = () => {
  emit('update:show', false);
};
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="close"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Upload & Crop Image</h3>
          <button
            @click="close"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-4">
            <!-- File Input -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Image
              </label>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                class="hidden"
              />
              <button
                @click="fileInput?.click()"
                class="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#01779b] dark:hover:border-[#01779b] transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400"
              >
                <Upload class="h-5 w-5" />
                <span>Choose Image</span>
              </button>
            </div>

            <!-- Crop Area -->
            <div v-if="imageLoaded" class="space-y-4">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Drag to move, use controls to zoom and rotate
              </div>
              
              <div
                ref="container"
                class="relative mx-auto"
                :style="{ 
                  width: containerSize.width + 'px', 
                  height: containerSize.width + 'px',
                  maxWidth: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: '#f3f4f6'
                }"
                @mousedown="startDrag"
                @mousemove="drag"
                @mouseup="endDrag"
                @mouseleave="endDrag"
                @touchstart="startDrag"
                @touchmove="drag"
                @touchend="endDrag"
              >
                <img
                  v-if="previewImageSrc"
                  :src="previewImageSrc"
                  :style="{
                    ...imageStyle,
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transformOrigin: 'center center',
                    maxWidth: 'none',
                  }"
                  class="select-none pointer-events-none"
                  draggable="false"
                />
                
                <!-- Circular Crop overlay -->
                <div class="absolute inset-0 pointer-events-none">
                  <!-- Dark overlay outside circle using SVG -->
                  <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <mask id="circleMask">
                        <rect width="100" height="100" fill="white"/>
                        <circle cx="50" cy="50" r="50" fill="black"/>
                      </mask>
                    </defs>
                    <rect width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#circleMask)"/>
                  </svg>
                  <!-- Perfect circle border -->
                  <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="50" 
                      fill="none" 
                      stroke="#01779b" 
                      stroke-width="0.8"
                      vector-effect="non-scaling-stroke"
                    />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="49.2" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.9)" 
                      stroke-width="0.4"
                      vector-effect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>

              <!-- Controls -->
              <div class="flex items-center justify-center gap-2 flex-wrap">
                <button
                  @click="zoom(-0.1)"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut class="h-5 w-5" />
                </button>
                <button
                  @click="zoom(0.1)"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn class="h-5 w-5" />
                </button>
                <button
                  @click="rotate"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Rotate 90°"
                >
                  <RotateCw class="h-5 w-5" />
                </button>
                <button
                  @click="centerImage"
                  class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Reset Position"
                >
                  <Move class="h-5 w-5" />
                </button>
              </div>
            </div>

            <!-- Preview -->
            <div v-if="imageLoaded" class="flex items-center justify-center">
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Preview (circular crop)
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            @click="close"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            v-if="imageLoaded"
            @click="cropImage"
            class="px-4 py-2 text-sm font-medium text-white bg-[#01779b] dark:bg-[#01779b] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors flex items-center gap-2"
          >
            <Check class="h-4 w-4" />
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  </Transition>
  
  <!-- Hidden canvas for cropping -->
  <canvas ref="canvas" class="hidden"></canvas>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

