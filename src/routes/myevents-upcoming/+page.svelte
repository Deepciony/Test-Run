<script lang="ts">
  import { link } from "svelte-spa-router";

    let activeTab = 'upcoming';

    let events = [
        {
            id: 1,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "12345",
            status: "joined",
            type: "upcoming",
        },
        {
            id: 2,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "12345",
            status: "checked-in",
            type: "upcoming",
        },
        {
            id: 3,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "12345",
            status: "completed",
            type: "upcoming",
        },
        {
            id: 4,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "99999",
            status: "cancel",
            type: "history",
        },
        {
            id: 5,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "99999",
            status: "completed",
            type: "history",
        },
        {
            id: 6,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "99999",
            status: "completed",
            type: "history",
        },
        {
            id: 7,
            title: "KASETSART RUN OF HEALTH",
            date: "Sunday, January 14, 2024",
            time: "05:00 AM - 09:00 AM",
            location: "Kasetsart University, Sriracha",
            image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop",
            pincode: "99999",
            status: "completed",
            type: "history",
        }
    ];

    $: filteredEvents = events.filter(e => e.type === activeTab);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'joined': return 'background-color: #0066FF; color: white;';
            case 'checked-in': return 'background-color: #FFE600; color: black;';
            case 'completed': return 'background-color: #10B981; color: white;';
            case 'cancel': return 'background-color: #b4151d; color: white;';
            default: return 'background-color: gray;';
        }
    };

    const getStatusText = (status: string) => {
        if (status === 'joined') return 'Joined';
        if (status === 'checked-in') return 'Checked-in';
        if (status === 'completed') return 'Completed';
        if (status === 'cancel') return 'Cancel';
        return status;
    };
    
</script>



<div class = "mobile-wrapper">
    <header class = "header">
        <button class = "back-btn" aria-label="Back">
            <svg width = "24" height = "24" viewBox = "0 0 24 24" fill = "none" stroke = "currentColor" stroke-width = "2">
                <path d = "M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <h1>MY EVENTS</h1>
        <div style = "width: 36px;"></div> 
    </header>

    <div class = "tabs-container">
        <div class = "tabs-bg">
            <button 
                class="tab-btn {activeTab === 'upcoming' ? 'active' : ''}"
                on:click={() => activeTab = 'upcoming'}>
                Upcoming
            </button>
            <button
                class = "tab-btn {activeTab === 'history' ? 'active' : ''}"
                on:click = {() => activeTab = 'history'}>
                History
            </button>
        </div>
    </div>
    <div class = "event-list">
        {#each filteredEvents as event (event.id)}
            <div class = "card">
                <div class = "card-image">
                    <img src={event.image} alt={event.title}/>
                </div>
                <div class = "card-content">
                    <h3 class = "card-title">{event.title}</h3>

                    <div class = "info-row">
                        <span class = "icon">📅</span> <span>Date: {event.date}</span>
                    </div>
                    <div class = "info-row">
                        <span class = "icon">⏰</span> <span>TIme: {event.time}</span>
                    </div>
                    <div class = "info-row">
                        <span class = "icon">📍</span> <span>Location: {event.location}</span>
                    </div>
                    {#if event.status !== 'joined' && event.type !== 'history'}
                        <div class = "info-row">
                            <span class = "icon">🔢</span> <span>Pin code: {event.pincode}</span>
                        </div>
                    {/if}

                    <div class = "card-action">
                        <button class = "status-btn" style = {getStatusStyle(event.status)}>
                            {getStatusText(event.status)}
                        </button>

                    </div>

                </div>

            </div>
            {/each}
    </div>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    :global(body){
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        background-color: #111827;
        color: white;
        font-family: 'Inter', sans-serif;
    }
    
    .mobile-wrapper {
        width: 100%;
        max-width: 410px;
        margin: 0 auto;
        padding: 20px;
        min-height: 100vh;
        box-sizing: border-box;
    }

    @media (max-width: 480px) {
        .mobile-wrapper {
            padding: 16px;
        }

        .card-image {
            height: 140px;
        }

        .card-title {
            font-size: 15px;
        }
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-top: 10px;
    }

    .header h1 {
        font-size: 28px;
        font-weight: 600;
        letter-spacing: 1px;
        margin: 0;
    }

    .back-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 36px; 
        height: 36px;
        display: flex; 
        align-items: center; 
        justify-content: center;
        color: white;
        cursor: pointer;
    }

    .tabs-container {
        display:  flex;
        justify-content: center;
        margin-bottom: 24px;
    }

    .tabs-bg {
        background-color: #E5E7EB;
        border-radius: 50px;
        padding: 4px;
        display: flex;
        width: 240px;
    }

    .tab-btn {
        flex: 1;
        background: transparent;
        border: none;
        padding: 8px 0;
        border-radius: 40px;
        color: #6B7280;
        font-weight: 500;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        transition: 0.2s;
    }

    .tab-btn.active {
        background-color: white;
        color: #111827;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        font-weight: 600;
    }

    .event-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .card {
        background: rgb(255, 255, 255);
        border-radius: 16px;
        overflow: hidden;
        color: #333;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .card-image {
        height: 160px;
        width: 100%;
        object-fit: cover;
    }

    .card-image img {
        height: 150px;
        width: 100%;
        object-fit: cover;
    }

    .card-content {
        padding: 16px;
    }

    .card-title {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
    }

    .info-row {
        display: flex;
        gap: 8px;
        font-size: 13px;
        color: #4B5563;
        margin-bottom: 6px;
        align-items: flex-start;
    }

    .icon {
        min-width: 20px;
        text-align: center;
    }

    .card-action {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
    }
    
    .status-btn {
        border: none;
        padding: 8px 24px;
        border-radius: 99px;
        font-size: 12px;
        font-weight: 600;
        font-family: 'Inter', sans-serif;
        cursor: pointer;

        width: 130px;
        text-align: center;
        display: inline-block;
    }


</style>