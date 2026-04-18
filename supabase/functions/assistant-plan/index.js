const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

const OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'recommendedFocus', 'quickWin', 'questions', 'taskSuggestions'],
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
        questions: {
            type: 'array',
            items: {
                type: 'string'
            },
            maxItems: 5
        },
        taskSuggestions: {
            type: 'array',
            maxItems: 5,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description', 'why', 'dueDate', 'energyFit', 'steps'],
                properties: {
                    title: {
                        type: 'string'
                    },
                    description: {
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

function plannerInstructions() {
    return [
        'You are the planning engine behind a personal dashboard assistant.',
        'Turn the user dump into an actionable plan.',
        'Do not pretend any work has been done.',
        'Do not give therapy, medical, legal, or financial advice.',
        'Keep the output grounded in what the user wrote plus the provided context.',
        'Return 1-5 task suggestions.',
        'Task titles must be specific and human-sounding, not generic.',
        'Only include a dueDate when the user clearly gave a deadline. Otherwise return null.',
        'Steps must be concrete next actions, not abstract restatements of the task.',
        'Use energyFit to estimate whether the task is low, medium, or high effort.',
        'Keep summary, recommendedFocus, and quickWin short.'
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

    const dump = sanitizeDump(body && body.dump);
    if (!dump) {
        return json({ error: 'The planner needs a non-empty dump.' }, 400);
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
            instructions: plannerInstructions(),
            input: buildInput({
                dump: dump,
                context: body && body.context ? body.context : {}
            }),
            text: {
                format: {
                    type: 'json_schema',
                    name: 'assistant_plan',
                    strict: true,
                    schema: OUTPUT_SCHEMA
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
