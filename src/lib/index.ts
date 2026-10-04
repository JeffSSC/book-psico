export * from './types/book';
export * from './data/bookMeta';
export * from './data/bookPages';
export * from './data/initialPages';
export * from './data/uiCopy';
export * from './stores/bookStore.svelte';
export * from './audio/sfx';

export { default as Book3DExperience } from './components/book/Book3DExperience.svelte';
export { default as BookReader } from './components/book/BookReader.svelte';
export { default as PageContentRenderer } from './components/book/PageContentRenderer.svelte';
export { default as BookHeader } from './components/ui/BookHeader.svelte';
export { default as BookFooter } from './components/ui/BookFooter.svelte';
export { default as TableOfContentsModal } from './components/ui/TableOfContentsModal.svelte';
