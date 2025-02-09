const supabaseUrl = 'https://kikivfglslrobwttvlvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2l2Zmdsc2xyb2J3dHR2bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTIwNDQsImV4cCI6MjA1MDA4ODA0NH0.Njo06GXSyZHjpjRwPJ2zpElJ88VYgqN2YYDfTJnBQ6k';

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Couleurs DS
const DS_COLORS = {
    blue: '#005386',
    green: '#6EBE44',
    red: '#FF4444',
    orange: '#FFA500'
};

const OPTIONS_IMPACT = {
    amr: { quality: 0, capacity: 0, delivery: 0.0 },
    ar: { quality: 0, capacity: 0, delivery: 0 },
    kitting: { quality: -2.15, capacity: +1.7, delivery: 0 },
    assembly: { quality: -2.95, capacity: 0, delivery: 0 },
    mes: { quality: 0, capacity: +1.7, delivery: 2.0 },
    pick: { quality: 0, capacity: +0.5, delivery: 6.0 },
    line: { quality: 0, capacity: +1.6, delivery: 0 }
};

const INDICATORS = {
    quality: { 
        title: "Cost of non quality", 
        target: 4.0,
        baseline: 9.0,
        min: 0,
        max: 10.0,
        isQuality: true,
        unit: "% of COGS",
        getImprovement: (value, baseline) => (baseline - value).toFixed(1)
    },
    capacity: { 
        title: "Productivity", 
        target: 12,
        baseline: 7,
        min: 0,
        max: 15,
        isQuality: false,
        unit: " pcs/pers/h",
        getImprovement: (value, baseline) => (value - baseline).toFixed(1)
    },
    delivery: { 
        title: "Planning Adherence", 
        target: 95,
        baseline: 87,
        min: 0,
        max: 100,
        isQuality: false,
        unit: "%",
        getImprovement: (value, baseline) => (value - baseline).toFixed(1)
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

function getProgressColor(value, target, isQuality, config) {
    if (isQuality) {
        // Pour la qualité, plus bas est meilleur
        const range = config.baseline - target; // écart entre baseline et target
        const midPoint = target + (range * 0.4); // point où on passe de vert à orange
        const highPoint = target + (range * 0.7); // point où on passe d'orange à rouge
        
        if (value <= midPoint) {
            return DS_COLORS.green; // Proche de la target (bon)
        } else if (value <= highPoint) {
            return DS_COLORS.orange; // Zone intermédiaire
        } else {
            return DS_COLORS.red; // Proche de la baseline (mauvais)
        }
    } else {
        // Pour les autres indicateurs, plus haut est meilleur
        if (value >= target) {
            return DS_COLORS.green; // Au-dessus ou égal à la target (bon)
        } else if (value >= target * 0.8) {
            return DS_COLORS.orange; // Au moins 80% de la target
        } else {
            return DS_COLORS.red; // Moins de 80% de la target
        }
    }
}

function getTotalImpact(key) {
    return Object.keys(switchStates).reduce((acc, lever) => {
        if (switchStates[lever]) {
            acc += OPTIONS_IMPACT[lever][key];
        }
        return acc;
    }, 0);
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
    const isTargetReached = config.isQuality ? value <= config.target : value >= config.target;
    const progressColor = getProgressColor(value, config.target, config.isQuality, config);
    const targetColor = isTargetReached ? DS_COLORS.green : DS_COLORS.blue;
    const improvementPoints = config.getImprovement(value, config.baseline);
    const isPositive = config.isQuality ? improvementPoints > 0 : improvementPoints > 0;

    return `
        <div class="indicator-card">
            <div class="indicator-title">${config.title}</div>
            <div class="vertical-progress">
                <div class="vertical-fill" style="height: ${percentage}%; background-color: ${progressColor};">
                    <span>${value.toFixed(1)}${config.unit}</span>
                </div>
                <div class="target-line" style="bottom: ${targetPercentage}%; background-color: ${targetColor};"></div>
            </div>
            <div class="target-value" style="color: ${targetColor}">Target: ${config.target}${config.unit}</div>
            <div class="initial-value">Initial Value: ${config.baseline}${config.unit}</div>
            <div class="improvement-badge ${isPositive ? 'positive' : 'negative'}">
                ${improvementPoints >= 0 ? '+' : '-'}${Math.abs(improvementPoints)}
            </div>
        </div>
    `;
}

function handleRealtimeUpdate(payload) {
    if (payload.new && payload.new.name) {
        switchStates[payload.new.name] = payload.new.is_active;
        updateDisplay();
    }
}

function updateDisplay() {
    const indicatorsDiv = document.getElementById("indicators");
    if (indicatorsDiv) {
        indicatorsDiv.innerHTML = Object.keys(INDICATORS)
            .map(key => createProgressBar(key, INDICATORS[key]))
            .join('');
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
            if (status === 'CHANNEL_ERROR') {
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
    updateDisplay();
    fetchLevers();
    setupRealtimeSubscription();
});