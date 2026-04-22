const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

const OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'recommendedFocus', 'quickWin', 'taskSuggestions'],
    properties: {
        summary: {
            type: 'string'
        },
        recommendedFocus: {
            type: 'string'
        },
        quickWin: {
            type: 'string'
        },
        taskSuggestions: {
            type: 'array',
            maxItems: 5,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'why', 'dueDate', 'energyFit', 'steps'],
                properties: {
                    title: {
                        type: 'string'
                    },
                    why: {
                        type: 'string'
                    },
                    dueDate: {
                        type: ['string', 'null']
                    },
                    energyFit: {
                        type: 'string',
                        enum: ['low', 'medium', 'high']
                    },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        maxItems: 6
                    }
                }
            }
        }
    }
};

const EXPAND_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['detail', 'steps'],
    properties: {
        detail: {
            type: 'string'
        },
        steps: {
            type: 'array',
            items: {
                type: 'string'
            },
            maxItems: 8
        }
    }
};

function json(body, status) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: corsHeaders
    });
}

function sanitizeDump(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildInput(body) {
    const sections = [
        'BRAIN DUMP:',
        body.dump
    ];

    const context = body.context && typeof body.context === 'object' ? body.context : {};
    if (context.bodyStatus) {
        sections.push('', 'BODY CONTEXT:', String(context.bodyStatus));
    }

    if (context.safeToSpend !== null && context.safeToSpend !== undefined && context.safeToSpend !== '') {
        sections.push('', 'MONEY CONTEXT:', JSON.stringify(context.safeToSpend));
    }

    return sections.join('\n');
}

function extractOutputText(responseBody) {
    if (responseBody && typeof responseBody.output_text === 'string' && responseBody.output_text.trim()) {
        return responseBody.output_text;
    }

    const output = Array.isArray(responseBody && responseBody.output) ? responseBody.output : [];
    for (const item of output) {
        const content = Array.isArray(item && item.content) ? item.content : [];
        for (const part of content) {
            if (part && part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
                return part.text;
            }
            if (part && part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
                return part.text;
            }
        }
    }

    return '';
}

function expandInstructions() {
    return [
        'You are the planning engine behind a personal dashboard assistant.',
        'The user is stuck on one specific task and needs deeper help — not a summary of what they already know.',
        'Do NOT restate the task title or repeat any of the original steps back to the user.',
        'detail: 1-2 short sentences covering something genuinely new: a common blocker they may not have anticipated, a lower-friction way to start, or what "done" actually looks like for this task. Plain language only. No therapy, medical, legal, or financial advice.',
        'steps: 3-8 concrete next actions that ADD specificity not present in the original steps — things like exact info to gather, fallback options if the first approach fails, or small sub-tasks the original steps skipped.',
        'Every step must be something new. If the original steps already said it, do not say it again in different words.',
        'Stay grounded in what the user wrote. Do not invent new deadlines or unrelated tasks.'
    ].join(' ');
}

function buildExpandInput(body) {
    const task = body.task && typeof body.task === 'object' ? body.task : {};
    const sections = [
        'TASK:',
        'Title: ' + (typeof task.title === 'string' ? task.title : ''),
        'Why it matters: ' + (typeof task.why === 'string' ? task.why : ''),
    ];

    if (Array.isArray(task.steps) && task.steps.length > 0) {
        sections.push('Current steps:');
        task.steps.forEach(function(step) {
            if (typeof step === 'string' && step.trim()) {
                sections.push('- ' + step);
            }
        });
    }

    if (typeof body.originalDump === 'string' && body.originalDump.trim()) {
        sections.push('', 'ORIGINAL BRAIN DUMP (context only):', body.originalDump.trim());
    }

    return sections.join('\n');
}

function plannerInstructions() {
    return [
        'You are the planning engine behind a personal dashboard assistant.',
        'Turn the user dump into an actionable plan.',
        'Do not pretend any work has been done.',
        'Do not give therapy, medical, legal, or financial advice.',
        'Keep the output grounded in what the user wrote plus the provided context.',
        'Return 1-5 task suggestions.',
        'summary: one short sentence mirroring what the user said back to them. No advice, no tasks, no restating the plan.',
        'recommendedFocus: name the exact task from your taskSuggestions to do first. One short phrase, not a sentence.',
        'quickWin: a fast 5-minute action that is different from recommendedFocus. If nothing fits, return an empty string.',
        'Do not repeat content across summary, recommendedFocus, and quickWin. Each must say something different.',
        'Task titles must be specific and human-sounding, not generic.',
        'why: one short reason in 8 words or fewer. No filler, no repeating the title.',
        'Only include a dueDate when the user clearly gave a deadline. Otherwise return null.',
        'Steps must be concrete next actions, not abstract restatements of the task.',
        'Use energyFit to estimate whether the task is low, medium, or high effort.'
    ].join(' ');
}

Deno.serve(async function(req) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
        return json({ error: 'AI planner is not configured yet.' }, 503);
    }

    let body;
    try {
        body = await req.json();
    } catch (err) {
        return json({ error: 'Invalid JSON body.' }, 400);
    }

    const mode = body && body.mode === 'expand' ? 'expand' : 'plan';

    let instructions;
    let input;
    let schema;
    let schemaName;

    if (mode === 'expand') {
        const task = body && body.task;
        if (!task || typeof task !== 'object' || typeof task.title !== 'string' || !task.title.trim()) {
            return json({ error: 'Expand needs a task with a title.' }, 400);
        }
        instructions = expandInstructions();
        input = buildExpandInput(body);
        schema = EXPAND_SCHEMA;
        schemaName = 'assistant_expand';
    } else {
        const dump = sanitizeDump(body && body.dump);
        if (!dump) {
            return json({ error: 'The planner needs a non-empty dump.' }, 400);
        }
        instructions = plannerInstructions();
        input = buildInput({
            dump: dump,
            context: body && body.context ? body.context : {}
        });
        schema = OUTPUT_SCHEMA;
        schemaName = 'assistant_plan';
    }

    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';

    const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: model,
            instructions: instructions,
            input: input,
            text: {
                format: {
                    type: 'json_schema',
                    name: schemaName,
                    strict: true,
                    schema: schema
                }
            }
        })
    });

    const upstreamText = await upstream.text();
    let upstreamBody;
    try {
        upstreamBody = upstreamText ? JSON.parse(upstreamText) : {};
    } catch (err) {
        upstreamBody = { error: upstreamText || 'Unknown upstream error.' };
    }

    if (!upstream.ok) {
        return json({
            error: upstreamBody && upstreamBody.error && upstreamBody.error.message
                ? upstreamBody.error.message
                : 'Planner request failed.'
        }, upstream.status);
    }

    const outputText = extractOutputText(upstreamBody);
    if (!outputText) {
        return json({ error: 'Planner returned no output.' }, 502);
    }

    try {
        const result = JSON.parse(outputText);
        return json({
            result: result,
            provider: 'openai',
            model: model
        });
    } catch (err) {
        return json({ error: 'Planner returned invalid JSON.' }, 502);
    }
});
