<script lang="ts">
    import Swal from 'sweetalert2';

    // ข้อมูลตัวอย่าง
    let submissions = [
        { id: 1, runnerName: "Test One", submitTime: "09:20", proofImage: "https://images.unsplash.com/photo-1557166983-5939644443a0?auto=format&fit=crop&w=800&q=80" },
        { id: 2, runnerName: "Sarah Runner", submitTime: "10:45", proofImage: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80" },
        { id: 3, runnerName: "John Doe", submitTime: "11:30", proofImage: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80" },
        { id: 4, runnerName: "Michael Smith", submitTime: "12:15", proofImage: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=800&q=80" },
        { id: 5, runnerName: "Anna Bell", submitTime: "13:00", proofImage: "https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=800&q=80" }
    ];

    function removeSubmission(id: number) {
        submissions = submissions.filter(item => item.id !== id);
    }

    function handleConfirm(item: any) {
        Swal.fire({
            title: 'Verified!',
            text: `Submission for ${item.runnerName} accepted.`,
            icon: 'success',
            iconColor: '#10B981',
            confirmButtonColor: '#10B981',
            showConfirmButton: false,
            timer: 1500,
            width: '320px',
            customClass: { popup: 'my-swal-popup' }
        }).then(() => removeSubmission(item.id));
    }

    async function handleReject(item: any) {
        const { value: formValues } = await Swal.fire({
            title: 'Reject Submission',
            html: `<div class="reject-form">... form ...</div>`, 
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'REJECT',
            width: '320px',
            customClass: { popup: 'my-swal-popup' }
        });
        
        if (formValues) {
             Swal.fire({ title: 'Rejected', icon: 'error', width: '320px', showConfirmButton: false, timer: 1500 });
             removeSubmission(item.id);
        }
    }
</script>

<div class="app-screen">
    
    <div class="glass-header">
        <a href="/home" class="back-btn" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>

        <div class="header-inner">
            <h1 class="page-title">VERIFY PROOF</h1>
        </div>
    </div>

    <div class="scroll-container">
        <div class="content-wrapper">
            {#if submissions.length === 0}
                <div class="empty-state">
                    <p>No pending submissions.</p>
                </div>
            {:else}
                {#each submissions as item (item.id)}
                    <div class="verify-card">
                        <div class="card-header">
                            <h2 class="card-heading">Verify Submission</h2>
                        </div>
                        <div class="info-section">
                            <div class="info-row">
                                <span class="info-label">Runner:</span> <span class="info-value">{item.runnerName}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Time:</span> <span class="info-value">{item.submitTime}</span>
                            </div>
                        </div>
                        <div class="image-container">
                            <img src={item.proofImage} alt="Proof" class="proof-img" />
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-reject" on:click={() => handleReject(item)}>REJECT</button>
                            <button class="btn btn-confirm" on:click={() => handleConfirm(item)}>CONFIRM</button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    :global(body) {
        margin: 0; padding: 0;
        background-color: #111827; 
        font-family: 'Inter', sans-serif;
        overflow: hidden;
    }

    .app-screen {
        height: 100vh;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .glass-header {
        position: absolute;
        top: 0; 
        left: 0; 
        width: 100%;
        height: 80px; 
        z-index: 50;
        background: rgba(17, 24, 39, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .header-inner {
        width: 100%; 
        max-width: 400px; 
        padding: 0 20px;
        display: flex; 
        align-items: center; 
        justify-content: center;
    }

    .back-btn {
        position: absolute; 
        left: 20px; 
        width: 36px; 
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex; align-items: center; 
        justify-content: center;
        color: white; cursor: pointer; 
        transition: 0.2s;
        z-index: 60; 
    }
    .back-btn:hover { background: rgba(255, 255, 255, 0.2); }

    .page-title {
        color: white; 
        font-size: 28px; 
        font-weight: 700; 
        letter-spacing: 1px;
    }

    .scroll-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch; 
        padding-top: 110px;
        padding-bottom: 40px;
    }
    .scroll-container::-webkit-scrollbar { display: none; }
    .scroll-container { -ms-overflow-style: none; scrollbar-width: none; }

    .content-wrapper {
        width: 100%; 
        max-width: 400px;
        margin: 0 auto; 
        padding: 0 20px;
        display: flex; 
        flex-direction: column; 
        gap: 20px;
         box-sizing: border-box;
    }

    .verify-card {
        background: white; 
        border-radius: 20px; 
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column; 
        gap: 16px;
        transition: transform 0.2s;
    }
    .verify-card:active { transform: scale(0.98); }

    .card-heading { font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
    
    .info-section { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: #374151; }
    .info-label { font-weight: 600; color: #111827; }

    .image-container {
        width: 100%; 
        height: 220px;
        background: #F3F4F6; 
        border-radius: 12px;
        overflow: hidden; 
        border: 1px solid #E5E7EB;
        display: flex; 
        align-items: center; 
        justify-content: center;
    }
    .proof-img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    }

    .action-buttons { 
        display: flex; 
        gap: 10px; 
    }
    .btn { 
        flex: 1; 
        padding: 12px; 
        border-radius: 10px; 
        font-size: 13px; 
        font-weight: 700; 
        cursor: pointer; 
        border: none; 
    }
    .btn-reject { 
        background: #B4151D; 
        color: white; 
        border: 1px solid #FCA5A5; 
    }
    .btn-confirm { 
        background: #10B981; 
        color: white; 
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); 
    }

    .empty-state { 
        text-align: center; 
        color: rgba(255,255,255,0.5); 
        margin-top: 50px; 
    }

</style>