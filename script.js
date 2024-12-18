const supabaseUrl = 'https://kikivfglslrobwttvlvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2l2Zmdsc2xyb2J3dHR2bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTIwNDQsImV4cCI6MjA1MDA4ODA0NH0.Njo06GXSyZHjpjRwPJ2zpElJ88VYgqN2YYDfTJnBQ6k';

// Création du client Supabase
const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const OPTIONS_IMPACT = {
    amr: { quality: -0.6, capacity: +5.3, delivery: +0.7 },
    ar: { quality: -0.6, capacity: +6.3, delivery: +0.7 },
    kitting: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    assembly: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    mes: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    pick: { quality: -0.6, capacity: +3.6, delivery: +0.7 },
    line: { quality: -0.5, capacity: +0, delivery: +0.8 }
};

const ACRONYM_DEFINITIONS = {
    amr: "Autonomous Mobile Robot",
    ar: "Augmented Reality",
    kitting: "Kit Preparation Process",
    assembly: "Assembly Line Optimization",
    mes: "Manufacturing Execution System",
    pick: "Pick-to-Light System",
    line: "Production Line Balancing"
};

const INDICATORS = {
    quality: { 
        title: "Quality", 
        target: 0.1,
        baseline: 4.0,
        min: 0.1,
        max: 4.0,
        isQuality: true,
        unit: " scrap/day",
        getPercentage: (value, baseline) => ((baseline - value) / baseline * 100).toFixed(1)
    },
    capacity: { 
        title: "Capacity", 
        target: 60,
        baseline: 37,
        min: 0,
        max: 70,
        isQuality: false,
        unit: "/h",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    },
    delivery: { 
        title: "Delivery", 
        target: 98,
        baseline: 93,
        min: 0,
        max: 100,
        isQuality: false,
        unit: "%",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    }
};

let metrics = {
    quality: 4.0,
    capacity: 37,
    delivery: 93
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
    const percentage = ((value - config.min) / (config.max - config.min)) * 100;
    const targetPercentage = ((config.target - config.min) / (config.max - config.min)) * 100;

    const isTargetReached = config.isQuality ? value <= config.target : value >= config.target;
    const progressColor = isTargetReached ? '#6EBE44' : '#005386';

    const improvementPercentage = config.getPercentage(value, config.baseline);

    return `
        <div class="text-center">
            <div class="indicator-title">${config.title}</div>
            <div class="relative vertical-progress">
                <div class="vertical-fill" style="height: ${percentage}%; background-color: ${progressColor};">
                    <span class="text-white font-bold">${value.toFixed(1)}${config.unit}</span>
                </div>
                <div class="target-line" style="bottom: ${100 - targetPercentage}%"></div>
                <div class="target-label" style="bottom: ${100 - targetPercentage}%">Target: ${config.target}${config.unit}</div>
            </div>
            <div class="base-value">Base Value: ${config.baseline}${config.unit}</div>
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
        
        // Mise à jour locale immédiate
        switchStates[leverName] = newState;
        updateDisplay();
        
    } catch (err) {
        console.error('Error updating lever:', err);
        // En cas d'erreur, revenir à l'état précédent
        switchStates[leverName] = !newState;
        updateDisplay();
    }
}

function createLeverButton(lever) {
    const container = document.createElement('div');
    const leverData = ACRONYM_DEFINITIONS[lever];
    
    container.innerHTML = `
        <button class="lever-button ${switchStates[lever] ? 'active' : ''}" data-lever="${lever}">
            <div class="text-xl font-semibold">${leverData}</div>
            <div class="tooltip">Impact - Quality: ${OPTIONS_IMPACT[lever].quality}%, 
                Capacity: ${OPTIONS_IMPACT[lever].capacity}%, 
                Delivery: ${OPTIONS_IMPACT[lever].delivery}%</div>
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
                // Tentative de reconnexion après 5 secondes
                setTimeout(setupRealtimeSubscription, 5000);
            }
        });
}

async function fetchIndicators() {
    try {
        const { data, error } = await supabaseClient
            .from('indicators')
            .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
            metrics = {
                quality: data.find(d => d.type === 'quality')?.value ?? metrics.quality,
                capacity: data.find(d => d.type === 'capacity')?.value ?? metrics.capacity,
                delivery: data.find(d => d.type === 'delivery')?.value ?? metrics.delivery
            };
            updateDisplay();
        }
    } catch (err) {
        console.error('Error fetching indicators:', err);
    }
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
    fetchIndicators();
    fetchLevers();
    setupRealtimeSubscription();
});