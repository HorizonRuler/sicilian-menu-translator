<script>
  // State variables
  let imageFile = null;
  let imagePreview = null;
  let isProcessing = false;
  let matchedTerms = [];
  let selectedTerm = null;
  let error = null;

  // Handle image upload from file input
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    imageFile = file;
    error = null;
    matchedTerms = [];
    selectedTerm = null;

    // Wait for preview to load first
    try {
      imagePreview = await fileToBase64(file);
    } catch (err) {
      error = 'Failed to read image file. Please try another file.';
      imageFile = null;
      return;
    }

    // Then process with Claude vision
    await processImage(file);
  }

  // Process image by calling our backend API
  async function processImage(file) {
    isProcessing = true;
    error = null;

    try {
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        error = 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).';
        isProcessing = false;
        return;
      }

      // Convert and compress file to base64 (stay under 5MB API limit)
      const base64Image = await compressImage(file);
      const base64Data = base64Image.split(',')[1]; // Remove data:image/jpeg;base64, prefix
      const mediaType = base64Image.startsWith('data:image/jpeg') ? 'image/jpeg' : file.type;

      // Call our backend API (no CORS issues!)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Data,
          mediaType: mediaType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error || 'Failed to analyze image. Please try again.';
        isProcessing = false;
        return;
      }

      // Extract response from backend
      const message = data.response;

      // Validate response structure
      if (!message.content || !message.content[0] || !message.content[0].text) {
        error = 'Unexpected response format from API.';
        isProcessing = false;
        return;
      }

      const responseText = message.content[0].text;
      console.log('Claude response:', responseText);

      // Extract and parse JSON safely
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate structure
          if (Array.isArray(parsed) && parsed.every(item =>
            item.name && item.definition
          )) {
            matchedTerms = parsed;
          } else {
            console.warn('Invalid dish structure in response:', parsed);
            matchedTerms = [];
          }
        } else {
          matchedTerms = [];
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        console.error('Raw response:', responseText);
        matchedTerms = [];
        error = 'Failed to parse response. Please try again.';
      }

    } catch (err) {
      console.error('API Error:', err);
      error = err.message || 'Failed to analyze image. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  // Helper function to convert File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Compress image to stay under 5MB API limit
  async function compressImage(file) {
    const maxSizeBytes = 3.5 * 1024 * 1024; // Target 3.5MB for safety buffer

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Always resize large phone photos (most are 4000+ pixels)
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Start with good quality, reduce until under limit
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);

        while (result.length * 0.75 > maxSizeBytes && quality > 0.2) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        const finalSizeMB = (result.length * 0.75 / 1024 / 1024).toFixed(2);
        console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${finalSizeMB}MB (q=${quality.toFixed(1)}, ${width}x${height})`);
        resolve(result);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }


  // Select a term to show its definition
  function selectTerm(term) {
    selectedTerm = selectedTerm === term ? null : term;
  }

  // Reset to initial state
  function reset() {
    imageFile = null;
    imagePreview = null;
    isProcessing = false;
    matchedTerms = [];
    selectedTerm = null;
    error = null;
  }
</script>

<main>
  <header>
    <h1>Menu Translator</h1>
    <p>Upload a menu photo to identify and explain dishes from any cuisine</p>
  </header>

  <div class="container">
    {#if !imagePreview}
      <!-- Initial upload state -->
      <div class="upload-section">
        <label for="imageInput" class="upload-button">
          Analyze Menu Photo
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
      <!-- Results with sticky image and scrollable list -->
      <div class="results-section">
        {#if isProcessing}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Analyzing menu with AI...</p>
            <p class="hint">This may take a few seconds</p>
          </div>
        {:else if error}
          <div class="error-state">
            <p>{error}</p>
            <button on:click={reset}>Try Another Photo</button>
          </div>
        {:else}
          <div class="results-layout">
            <!-- Sticky image column -->
            <div class="image-column">
              <div class="sticky-image">
                <img src={imagePreview} alt="Menu preview" />
              </div>
            </div>

            <!-- Scrollable list column -->
            <div class="list-column">
              {#if matchedTerms.length > 0}
                <h2>Identified Items</h2>
                <div class="items-list">
                  {#each matchedTerms as term, index}
                    <div class="item-row">
                      {#if term.imageUrl}
                        <img class="item-image" src={term.imageUrl} alt={term.name} />
                      {:else}
                        <span class="item-number">{index + 1}</span>
                      {/if}
                      <div class="item-details">
                        <h3>{term.name}</h3>
                        <p>{term.definition}</p>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="no-results">
                  <p>No special dishes or ingredients identified.</p>
                  <p class="hint">Make sure the photo shows menu items with dish names.</p>
                </div>
              {/if}
            </div>
          </div>

          <div class="button-container">
            <button class="reset-button" on:click={reset}>
              Analyze Another Photo
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <footer>
    <p>HorizonRuler 2025</p>
  </footer>
</main>

<style>
  /* Global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #fafaf8;
    min-height: 100vh;
  }

  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 40px;
    min-height: 100vh;
  }

  /* Header */
  header {
    text-align: center;
    margin-bottom: 60px;
    padding-bottom: 30px;
    border-bottom: 1px solid #d4d4d0;
  }

  h1 {
    margin: 0 0 12px 0;
    font-size: 2.5rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: #1a1a1a;
  }

  header p {
    margin: 0;
    font-size: 0.95rem;
    color: #6b6b68;
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  /* Container */
  .container {
    padding: 0;
    min-height: 300px;
  }

  /* Upload section */
  .upload-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    padding: 80px 20px;
  }

  #imageInput {
    display: none;
  }

  .upload-button {
    display: inline-block;
    background: #1a1a1a;
    color: #fafaf8;
    padding: 16px 48px;
    font-size: 0.95rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    border: 1px solid #1a1a1a;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .upload-button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Results section */
  .results-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }

  .image-container {
    position: relative;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    overflow: visible;
    border: 1px solid #e5e5e3;
  }

  .image-container img {
    width: 100%;
    display: block;
    max-height: 80vh;
    object-fit: contain;
    background: #ffffff;
  }

  /* Overlay messages (processing, error, no matches) */
  .overlay-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.98);
    padding: 40px;
    text-align: center;
    border: 1px solid #e5e5e3;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    max-width: 400px;
    z-index: 10;
  }

  .overlay-message p {
    margin: 12px 0;
    color: #1a1a1a;
    font-weight: 400;
  }

  .overlay-message .hint {
    font-size: 0.85rem;
    color: #6b6b68;
    font-weight: 400;
  }

  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 24px;
    border: 2px solid #e5e5e3;
    border-top: 2px solid #1a1a1a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-overlay p:first-child {
    color: #1a1a1a;
    font-size: 1rem;
    font-weight: 500;
  }

  .error-overlay button {
    margin-top: 20px;
    padding: 12px 32px;
    background: #1a1a1a;
    color: #fafaf8;
    border: 1px solid #1a1a1a;
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .error-overlay button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Loading and error states */
  .loading-state,
  .error-state {
    padding: 60px 20px;
    text-align: center;
  }

  .loading-state p,
  .error-state p {
    margin: 12px 0;
    color: #1a1a1a;
  }

  .loading-state .hint {
    font-size: 0.85rem;
    color: #6b6b68;
  }

  .error-state button {
    margin-top: 20px;
    padding: 12px 32px;
    background: #1a1a1a;
    color: #fafaf8;
    border: 1px solid #1a1a1a;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .error-state button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Results layout with sticky image */
  .results-layout {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 40px;
  }

  @media (max-width: 768px) {
    .results-layout {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .image-column {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 120px;
      z-index: 100;
    }

    .sticky-image {
      position: relative;
      top: 0;
    }

    .sticky-image img {
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .list-column {
      padding-bottom: 160px;
    }
  }

  .image-column {
    position: relative;
  }

  .sticky-image {
    position: sticky;
    top: 20px;
  }

  .sticky-image img {
    width: 100%;
    border: 1px solid #d4d4d0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .list-column {
    display: flex;
    flex-direction: column;
  }

  .list-column h2 {
    margin: 0 0 24px 0;
    font-size: 1.4rem;
    font-weight: 400;
    color: #1a1a1a;
    letter-spacing: 0.02em;
    border-bottom: 1px solid #d4d4d0;
    padding-bottom: 16px;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
  }

  .item-row {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: #ffffff;
    border: 1px solid #e5e5e3;
    transition: border-color 0.2s;
  }

  .item-row:hover {
    border-color: #1a1a1a;
  }

  .item-number {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    background: #1a1a1a;
    color: #fafaf8;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .item-image {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #e5e5e3;
  }

  .item-details h3 {
    margin: 0 0 6px 0;
    font-size: 1rem;
    font-weight: 500;
    color: #1a1a1a;
  }

  .item-details p {
    margin: 0;
    color: #6b6b68;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .no-results {
    padding: 40px 20px;
    text-align: center;
  }

  .no-results p {
    margin: 12px 0;
    color: #1a1a1a;
  }

  .no-results .hint {
    font-size: 0.85rem;
    color: #6b6b68;
  }

  /* Button container */
  .button-container {
    display: flex;
    justify-content: center;
    margin-top: 40px;
  }

  /* Reset button */
  .reset-button {
    width: auto;
    min-width: 200px;
    padding: 14px 40px;
    background: #1a1a1a;
    color: #fafaf8;
    border: 1px solid #1a1a1a;
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
  }

  .reset-button:hover {
    background: transparent;
    color: #1a1a1a;
  }

  /* Footer */
  footer {
    text-align: center;
    margin-top: 60px;
    padding-top: 30px;
    border-top: 1px solid #d4d4d0;
    color: #9b9b98;
    font-size: 0.85rem;
    font-weight: 400;
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

    .reset-button {
      width: 100%;
      min-width: auto;
    }

    .image-container {
      border-radius: 8px;
    }

    .marker {
      width: 32px;
      height: 32px;
      font-size: 0.9rem;
    }

    .popup {
      max-width: 260px;
      min-width: 240px;
      padding: 16px 20px;
      font-size: 0.9rem;
    }

    .popup h3 {
      font-size: 1.1rem;
    }

    .info-hint {
      font-size: 0.85rem;
      padding: 8px 16px;
      bottom: 12px;
    }

    .overlay-message {
      padding: 24px 28px;
      max-width: 90%;
    }
  }
</style>
