const supabaseUrl = 'https://kikivfglslrobwttvlvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2l2Zmdsc2xyb2J3dHR2bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTIwNDQsImV4cCI6MjA1MDA4ODA0NH0.Njo06GXSyZHjpjRwPJ2zpElJ88VYgqN2YYDfTJnBQ6k';

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const ACRONYM_DEFINITIONS = {
    amr: "Autonomous Mobile Robot",
    ar: "AR: Quality Assistance",
    kitting: "Kit Preparation Process",
    assembly: "AR: Assembly Assistance",
    mes: "Manufacturing Operation Management",
    pick: "Automatisation",
    line: "Layout"
};

const OPTIONS_IMPACT = {
    amr: { 
        quality: 0, 
        capacity: 0, 
        delivery: +4.0
    },
    ar: { 
        quality: -2.25, 
        capacity: 0, 
        delivery: 0 
    },
    kitting: { 
        quality: 0, 
        capacity: +1.7, 
        delivery: 0 
    },
    assembly: { 
        quality: -2.25, 
        capacity: 0, 
        delivery: 0 
    },
    mes: { 
        quality: 0, 
        capacity: +1.7, 
        delivery: 0 
    },
    pick: { 
        quality: 0, 
        capacity: +1.6, 
        delivery: 0 
    },
    line: { 
        quality: 0, 
        capacity: 0, 
        delivery: +4.0
    }
};

const INDICATORS = {
    quality: { 
        title: "Quality (Cost of non quality)", 
        target: 4.5,
        baseline: 9.0,
        min: 0,
        max: 10.0,
        isQuality: true,
        unit: "%",
        getPercentage: (value, baseline) => ((baseline - value) / baseline * 100).toFixed(1)
    },
    capacity: { 
        title: "Productivity (Parts/Person/Hour)", 
        target: 12,
        baseline: 7,
        min: 0,
        max: 15,
        isQuality: false,
        unit: " pcs/pers/h",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    },
    delivery: { 
        title: "Delivery (Planning Adherence)", 
        target: 95,
        baseline: 87,
        min: 0,
        max: 100,
        isQuality: false,
        unit: "%",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    }
};

let switchStates = {
    amr: false,
    ar: false,
    kitting: false,
    assembly: false,
    mes: false,
    pick: false,
    line: false
};

let channel = null;

function handleRealtimeUpdate(payload) {
    console.log('Changement reçu:', payload);
    if (payload.new && payload.new.name) {
        console.log(`Mise à jour du levier ${payload.new.name} à ${payload.new.is_active}`);
        switchStates[payload.new.name] = payload.new.is_active;
        updateDisplay();
    }
}

function calculateValue(key) {
    const baseValue = INDICATORS[key].baseline;
    const totalImpact = getTotalImpact(key);
    const newValue = baseValue + totalImpact;
    return Math.min(Math.max(newValue, INDICATORS[key].min), INDICATORS[key].max);
}

function createProgressBar(key, config) {
    const value = calculateValue(key);
    
    let percentage;
    if (config.isQuality) {
        percentage = ((value - config.min) / (config.max - config.min)) * 100;
    } else {
        percentage = ((value - config.min) / (config.max - config.min)) * 100;
    }

    const targetPercentage = ((config.target - config.min) / (config.max - config.min)) * 100;

    const isTargetReached = config.isQuality ? 
        value <= config.target : 
        value >= config.target;

    const progressColor = isTargetReached ? '#6EBE44' : '#005386';
    const improvementPercentage = config.getPercentage(value, config.baseline);

    return `
        <div class="text-center">
            <div class="indicator-title">${config.title}</div>
            <div class="relative vertical-progress">
                <div class="vertical-fill" style="height: ${percentage}%; background-color: ${progressColor};">
                    <span class="text-white font-bold">${value.toFixed(1)}${config.unit}</span>
                </div>
                <div class="target-line" style="bottom: ${targetPercentage}%"></div>
            </div>
            <div class="target-value">Target: ${config.target}${config.unit}</div>
            <div class="initial-value">Initial Value: ${config.baseline}${config.unit}</div>
            <div class="improvement-badge ${improvementPercentage < 0 ? 'negative' : 'positive'}">
                Improvement: ${Math.abs(improvementPercentage)}%
            </div>
        </div>
    `;
}

function getTotalImpact(key) {
    return Object.keys(switchStates).reduce((acc, lever) => {
        if (switchStates[lever]) {
            acc += OPTIONS_IMPACT[lever][key];
        }
        return acc;
    }, 0);
}

async function handleLeverClick(leverName) {
    const newState = !switchStates[leverName];
    
    try {
        const { error } = await supabaseClient
            .from('levers')
            .update({ is_active: newState })
            .eq('name', leverName);

        if (error) throw error;
        
        switchStates[leverName] = newState;
        updateDisplay();
        
    } catch (err) {
        console.error('Error updating lever:', err);
        switchStates[leverName] = !newState;
        updateDisplay();
    }
}

function createLeverButton(lever) {
    const container = document.createElement('div');
    const leverData = ACRONYM_DEFINITIONS[lever];
    
    container.innerHTML = `
        <button class="lever-button ${switchStates[lever] ? 'active' : ''}" data-lever="${lever}">
            <div class="lever-text">${leverData}</div>
        </button>
    `;
    
    const button = container.querySelector('button');
    button.addEventListener('click', () => handleLeverClick(lever));
    
    return container.firstElementChild;
}

function updateDisplay() {
    const indicatorsDiv = document.getElementById("indicators");
    if (indicatorsDiv) {
        indicatorsDiv.innerHTML = Object.keys(INDICATORS)
            .map(key => createProgressBar(key, INDICATORS[key]))
            .join('');
    }

    const leversDiv = document.getElementById("levers");
    if (leversDiv) {
        leversDiv.innerHTML = '';
        Object.keys(OPTIONS_IMPACT).forEach(lever => {
            const button = createLeverButton(lever);
            leversDiv.appendChild(button);
        });
    }
}

function setupRealtimeSubscription() {
    if (channel) {
        channel.unsubscribe();
    }

    channel = supabaseClient
        .channel('levers-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'levers'
            },
            handleRealtimeUpdate
        )
        .subscribe((status) => {
            console.log('Status de la souscription:', status);
            if (status === 'SUBSCRIBED') {
                console.log('Connecté avec succès aux mises à jour en temps réel');
            }
            if (status === 'CHANNEL_ERROR') {
                console.error('Erreur de connexion au canal');
                setTimeout(setupRealtimeSubscription, 5000);
            }
        });
}

async function fetchLevers() {
    try {
        const { data, error } = await supabaseClient
            .from('levers')
            .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
            switchStates = data.reduce((acc, lever) => {
                acc[lever.name] = lever.is_active;
                return acc;
            }, {...switchStates});
            updateDisplay();
        }
    } catch (err) {
        console.error('Error fetching levers:', err);
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de l\'application...');
    updateDisplay();
    fetchLevers();
    setupRealtimeSubscription();
});