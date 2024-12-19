// indicators.js
const supabaseUrl = 'https://kikivfglslrobwttvlvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2l2Zmdsc2xyb2J3dHR2bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTIwNDQsImV4cCI6MjA1MDA4ODA0NH0.Njo06GXSyZHjpjRwPJ2zpElJ88VYgqN2YYDfTJnBQ6k';

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const OPTIONS_IMPACT = {
    amr: { quality: 0, capacity: 0, delivery: +4.0 },
    ar: { quality: -2.25, capacity: 0, delivery: 0 },
    kitting: { quality: 0, capacity: +1.7, delivery: 0 },
    assembly: { quality: -2.25, capacity: 0, delivery: 0 },
    mes: { quality: 0, capacity: +1.7, delivery: 0 },
    pick: { quality: 0, capacity: +1.6, delivery: 0 },
    line: { quality: 0, capacity: 0, delivery: +4.0 }
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
    if (payload.new && payload.new.name) {
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
                <div class="target-line