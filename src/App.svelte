<script>
  import { createWorker } from 'tesseract.js';
  import { dictionary } from './dictionary.js';

  // State variables
  let imageFile = null;
  let imagePreview = null;
  let isProcessing = false;
  let ocrText = '';
  let matchedTerms = [];
  let expandedTerms = {};
  let error = null;

  // Handle image upload from file input
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    imageFile = file;
    error = null;
    matchedTerms = [];
    expandedTerms = {};
    ocrText = '';

    // Create image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);

    // Process with OCR
    await processImage(file);
  }

  // Process image with Tesseract.js OCR
  async function processImage(file) {
    isProcessing = true;
    error = null;

    try {
      // Initialize Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: m => console.log(m) // Log progress to console
      });

      // Perform OCR
      const { data: { text } } = await worker.recognize(file);
      ocrText = text;

      console.log('OCR Text extracted:', text);

      // Match terms from dictionary
      matchedTerms = findMatchingTerms(text);

      // Terminate worker to free memory
      await worker.terminate();

    } catch (err) {
      console.error('OCR Error:', err);
      error = 'Failed to process image. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  // Find matching dictionary terms in OCR text
  function findMatchingTerms(text) {
    const normalizedText = text.toLowerCase();
    const matches = [];
    const seenTerms = new Set();

    dictionary.forEach(term => {
      // Check main name
      if (normalizedText.includes(term.name.toLowerCase()) && !seenTerms.has(term.name)) {
        matches.push(term);
        seenTerms.add(term.name);
        return;
      }

      // Check alternate spellings
      if (term.alternates) {
        for (const alt of term.alternates) {
          if (normalizedText.includes(alt.toLowerCase()) && !seenTerms.has(term.name)) {
            matches.push(term);
            seenTerms.add(term.name);
            break;
          }
        }
      }
    });

    // Sort alphabetically
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Toggle term expansion
  function toggleTerm(termName) {
    expandedTerms[termName] = !expandedTerms[termName];
    expandedTerms = expandedTerms; // Trigger reactivity
  }

  // Reset to initial state
  function reset() {
    imageFile = null;
    imagePreview = null;
    isProcessing = false;
    ocrText = '';
    matchedTerms = [];
    expandedTerms = {};
    error = null;
  }
</script>

<main>
  <header>
    <h1>🍝 Sicilian Menu Translator</h1>
    <p>Upload a menu photo to identify Sicilian dishes</p>
  </header>

  <div class="container">
    {#if !imagePreview}
      <!-- Initial upload state -->
      <div class="upload-section">
        <label for="imageInput" class="upload-button">
          📷 Analyze Menu Photo
        </label>
        <input
          id="imageInput"
          type="file"
          accept="image/*"
          capture="environment"
          on:change={handleImageUpload}
        />
      </div>
    {:else}
      <!-- Image preview and results -->
      <div class="results-section">
        <div class="image-preview">
          <img src={imagePreview} alt="Menu preview" />
        </div>

        {#if isProcessing}
          <div class="processing">
            <div class="spinner"></div>
            <p>Processing image with OCR...</p>
            <p class="hint">This may take 5-10 seconds</p>
          </div>
        {:else if error}
          <div class="error">
            <p>❌ {error}</p>
            <button on:click={reset}>Try Another Photo</button>
          </div>
        {:else if matchedTerms.length > 0}
          <div class="matches">
            <h2>Found {matchedTerms.length} Sicilian {matchedTerms.length === 1 ? 'dish' : 'dishes'}:</h2>
            <div class="term-list">
              {#each matchedTerms as term}
                <div class="term-card">
                  <button 
                    class="term-header"
                    on:click={() => toggleTerm(term.name)}
                  >
                    <span class="term-name">{term.name}</span>
                    <span class="toggle-icon">
                      {expandedTerms[term.name] ? '−' : '+'}
                    </span>
                  </button>
                  {#if expandedTerms[term.name]}
                    <div class="term-definition">
                      {term.definition}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="no-matches">
            <p>🤷 No Sicilian dishes found in this image.</p>
            <p class="hint">Make sure the photo is clear and includes Sicilian menu items.</p>
          </div>
        {/if}

        {#if !isProcessing}
          <button class="reset-button" on:click={reset}>
            Analyze Another Photo
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <footer>
    <p>MVP • Supports 15 classic Sicilian dishes</p>
  </footer>
</main>

<style>
  /* Global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
  }

  /* Header */
  header {
    text-align: center;
    color: white;
    margin-bottom: 30px;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
  }

  header p {
    margin: 10px 0 0 0;
    opacity: 0.9;
    font-size: 1rem;
  }

  /* Container */
  .container {
    background: white;
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    min-height: 300px;
  }

  /* Upload section */
  .upload-section {
    text-align: center;
    padding: 60px 20px;
  }

  #imageInput {
    display: none;
  }

  .upload-button {
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .upload-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .upload-button:active {
    transform: translateY(0);
  }

  /* Results section */
  .results-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .image-preview {
    text-align: center;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  /* Processing state */
  .processing {
    text-align: center;
    padding: 40px 20px;
  }

  .spinner {
    width: 50px;
    height: 50px;
    margin: 0 auto 20px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .processing p {
    margin: 10px 0;
    color: #333;
  }

  .hint {
    font-size: 0.9rem;
    color: #666;
  }

  /* Error state */
  .error {
    text-align: center;
    padding: 30px;
    color: #d32f2f;
  }

  .error button {
    margin-top: 16px;
    padding: 12px 24px;
    background: #d32f2f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .error button:hover {
    background: #b71c1c;
  }

  /* Matches section */
  .matches h2 {
    margin: 0 0 20px 0;
    font-size: 1.4rem;
    color: #333;
  }

  .term-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .term-card {
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .term-card:hover {
    border-color: #667eea;
  }

  .term-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: white;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    text-align: left;
    transition: background 0.2s;
  }

  .term-header:hover {
    background: #f5f5f5;
  }

  .term-name {
    font-weight: 600;
    color: #333;
    font-size: 1.1rem;
  }

  .toggle-icon {
    font-size: 1.5rem;
    color: #667eea;
    font-weight: 300;
    min-width: 24px;
    text-align: center;
  }

  .term-definition {
    padding: 16px;
    background: #f9f9f9;
    border-top: 1px solid #e0e0e0;
    color: #555;
    line-height: 1.6;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* No matches state */
  .no-matches {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .no-matches p {
    margin: 10px 0;
  }

  .no-matches p:first-child {
    font-size: 1.2rem;
    color: #333;
  }

  /* Reset button */
  .reset-button {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .reset-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .reset-button:active {
    transform: translateY(0);
  }

  /* Footer */
  footer {
    text-align: center;
    margin-top: 30px;
    color: white;
    opacity: 0.8;
    font-size: 0.9rem;
  }

  /* Mobile responsive */
  @media (max-width: 600px) {
    main {
      padding: 15px;
    }

    .container {
      padding: 20px;
    }

    h1 {
      font-size: 1.6rem;
    }

    .upload-button {
      padding: 14px 28px;
      font-size: 1rem;
    }

    .image-preview img {
      max-height: 300px;
    }

    .term-name {
      font-size: 1rem;
    }
  }
</style>
