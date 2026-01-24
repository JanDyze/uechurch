import { ref } from 'vue';

// Global state for tracking active inline edit field
const activeEditId = ref(null);

export function useInlineEdit() {
  // Generate unique ID for each field
  const generateId = () => `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Check if this field is the active one
  const isActive = (id) => activeEditId.value === id;
  
  // Set this field as active (closes others)
  const setActive = (id) => {
    activeEditId.value = id;
  };
  
  // Clear active field
  const clearActive = () => {
    activeEditId.value = null;
  };
  
  return {
    activeEditId,
    generateId,
    isActive,
    setActive,
    clearActive,
  };
}
