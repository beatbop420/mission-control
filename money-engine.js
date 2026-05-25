(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.MoneyEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const VERSION = '2026-05-04';
    const USD = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const DEFAULT_SETTINGS = Object.freeze({
        activeCadence: 'paycheck',
        cushionTarget: 0,
        survivalAmount: 0,
        comfortAmount: 0,
        tinyCushionPercent: 0.01,
        tinyCushionCap: 10,
        tinyCushionAskThreshold: 1,
        tinyCushionChoice: 'ask',
        debtStrategyDefault: 'avalanche'
    });

    function formatCurrency(amount) {
        return USD.format(Number(amount || 0));
    }

    function centsToAmount(cents) {
        return Number((cents / 100).toFixed(2));
    }

    function amountToCents(value, label) {
        const number = Number(value ?? 0);
        if (!Number.isFinite(number) || number < 0) {
            throw new Error(label + ' must be a non-negative number');
        }
        return Math.round(number * 100);
    }

    function asPositiveRatio(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) return fallback;
        return number;
    }

    function asWholePeriods(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return 0;
        return Math.floor(number);
    }

    function sumCents(items, field) {
        return items.reduce(function (total, item) {
            return total + (item[field] || 0);
        }, 0);
    }

    function sortDebts(debts, strategy) {
        const cloned = debts.slice();
        const fallbackName = function (debt) {
            return String(debt.name || '').toLowerCase();
        };

        if (strategy === 'snowball') {
            return cloned.sort(function (a, b) {
                if (a.attackableBalanceCents !== b.attackableBalanceCents) {
                    return a.attackableBalanceCents - b.attackableBalanceCents;
                }
                if (a.apr !== b.apr) {
                    return b.apr - a.apr;
                }
                return fallbackName(a).localeCompare(fallbackName(b));
            });
        }

        return cloned.sort(function (a, b) {
            if (a.apr !== b.apr) {
                return b.apr - a.apr;
            }
            if (a.attackableBalanceCents !== b.attackableBalanceCents) {
                return b.attackableBalanceCents - a.attackableBalanceCents;
            }
            return fallbackName(a).localeCompare(fallbackName(b));
        });
    }

    function getCushionRate(currentBalanceCents, cushionTargetCents) {
        if (cushionTargetCents <= 0) return 0;
        const fullness = currentBalanceCents / cushionTargetCents;
        if (fullness < 0.5) return 0.50;
        if (fullness < 0.9) return 0.25;
        if (fullness < 1) return 0.10;
        return 0.02;
    }

    function toNamedAmountList(items, type) {
        return (items || []).map(function (item, index) {
            const name = String(item && item.name ? item.name : type + ' ' + (index + 1));
            return {
                id: item && item.id ? String(item.id) : type + '-' + (index + 1),
                name: name
            };
        });
    }

    function normalizeScenario(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('MoneyEngine.calculate requires an input object');
        }

        const settings = Object.assign({}, DEFAULT_SETTINGS, input.settings || {});
        const debtStrategyDefault = settings.debtStrategyDefault === 'snowball' ? 'snowball' : 'avalanche';
        const tinyCushionChoice = settings.tinyCushionChoice === 'yes' || settings.tinyCushionChoice === 'no'
            ? settings.tinyCushionChoice
            : 'ask';

        const bills = toNamedAmountList(input.bills, 'bill').map(function (base, index) {
            const source = input.bills[index] || {};
            return {
                id: base.id,
                name: base.name,
                amountCents: amountToCents(source.amount, 'bill.amount'),
                dueDate: source.dueDate || null,
                recurring: !!source.recurring,
                autoPay: !!source.autoPay,
                category: source.category || null,
                status: source.status || 'unpaid'
            };
        });

        const debts = toNamedAmountList(input.debts, 'debt').map(function (base, index) {
            const source = input.debts[index] || {};
            const balanceCents = amountToCents(source.balance, 'debt.balance');
            const minPaymentCents = amountToCents(source.minPayment, 'debt.minPayment');
            const minimumAppliedCents = Math.min(balanceCents, minPaymentCents);
            return {
                id: base.id,
                name: base.name,
                apr: asPositiveRatio(source.apr, 0),
                balanceCents: balanceCents,
                minPaymentCents: minPaymentCents,
                minimumAppliedCents: minimumAppliedCents,
                dueDate: source.dueDate || null,
                originalBalanceCents: amountToCents(
                    source.originalBalance == null ? centsToAmount(balanceCents) : source.originalBalance,
                    'debt.originalBalance'
                ),
                notes: source.notes || '',
                type: source.type || 'debt',
                attackableBalanceCents: Math.max(0, balanceCents - minimumAppliedCents)
            };
        });

        const futureFunds = toNamedAmountList(input.futureFunds, 'future-fund').map(function (base, index) {
            const source = input.futureFunds[index] || {};
            const targetCents = amountToCents(source.targetAmount, 'futureFund.targetAmount');
            const currentBalanceCents = amountToCents(source.currentBalance, 'futureFund.currentBalance');
            const periodsLeft = asWholePeriods(source.periodsLeft);
            const remainingNeedCents = Math.max(0, targetCents - currentBalanceCents);
            const recommendedContributionCents = periodsLeft > 0
                ? Math.ceil(remainingNeedCents / periodsLeft)
                : 0;

            return {
                id: base.id,
                name: base.name,
                targetAmountCents: targetCents,
                currentBalanceCents: currentBalanceCents,
                periodsLeft: periodsLeft,
                remainingNeedCents: remainingNeedCents,
                recommendedContributionCents: recommendedContributionCents,
                dueDate: source.dueDate || null
            };
        });

        const normalizedSettings = {
            activeCadence: String(settings.activeCadence || 'paycheck'),
            cushionTargetCents: amountToCents(settings.cushionTarget, 'settings.cushionTarget'),
            survivalAmountCents: amountToCents(settings.survivalAmount, 'settings.survivalAmount'),
            comfortAmountCents: amountToCents(settings.comfortAmount, 'settings.comfortAmount'),
            tinyCushionPercent: asPositiveRatio(settings.tinyCushionPercent, DEFAULT_SETTINGS.tinyCushionPercent),
            tinyCushionCapCents: amountToCents(settings.tinyCushionCap, 'settings.tinyCushionCap'),
            tinyCushionAskThreshold: asPositiveRatio(settings.tinyCushionAskThreshold, DEFAULT_SETTINGS.tinyCushionAskThreshold),
            tinyCushionChoice: tinyCushionChoice,
            debtStrategyDefault: debtStrategyDefault
        };

        return {
            incomeCents: amountToCents(input.incomeAmount, 'incomeAmount'),
            currentCushionBalanceCents: amountToCents(
                input.currentCushionBalance == null ? input.cushionCurrentBalance : input.currentCushionBalance,
                'currentCushionBalance'
            ),
            settings: normalizedSettings,
            bills: bills,
            debts: debts,
            futureFunds: futureFunds
        };
    }

    function distributeDebtAttack(debts, extraCents, strategy) {
        const orderedDebts = sortDebts(debts, strategy);
        let remaining = extraCents;
        const plan = [];

        orderedDebts.forEach(function (debt, orderIndex) {
            const attackAmount = Math.min(remaining, debt.attackableBalanceCents);
            remaining -= attackAmount;
            plan.push({
                id: debt.id,
                name: debt.name,
                order: orderIndex + 1,
                apr: debt.apr,
                extraPaymentCents: attackAmount,
                extraPayment: centsToAmount(attackAmount),
                projectedBalanceCents: Math.max(0, debt.attackableBalanceCents - attackAmount),
                projectedBalance: centsToAmount(Math.max(0, debt.attackableBalanceCents - attackAmount))
            });
        });

        return {
            strategy: strategy,
            plan: plan,
            allocatedCents: extraCents - remaining,
            allocatedAmount: centsToAmount(extraCents - remaining),
            leftoversCents: remaining,
            leftoversAmount: centsToAmount(remaining)
        };
    }

    function buildActionList(result) {
        const actions = [];

        if (result.allocations.mustPayBills > 0) {
            actions.push('Pay required bills and debt minimums: ' + formatCurrency(result.allocations.mustPayBills));
        }

        if (result.status === 'withdrawal_required' || result.status === 'hard_stop') {
            if (result.withdrawalGate.triggered) {
                actions.push('Ask whether to pull ' + formatCurrency(result.withdrawalGate.recommendedAmount) + ' from the cushion to bridge the must-pay gap.');
            }
            if (result.hardStop) {
                actions.push('Hard stop: even using the cushion would still leave a shortfall of ' + formatCurrency(result.summary.uncoveredShortfallAmount) + '.');
            }
            return actions;
        }

        if (result.allocations.futureBills > 0) {
            actions.push('Set aside for future bills: ' + formatCurrency(result.allocations.futureBills));
        }

        if (result.status === 'future_bills_short') {
            actions.push('Stop here: future bills are still short by ' + formatCurrency(result.summary.uncoveredShortfallAmount) + '.');
            return actions;
        }

        if (result.allocations.cushion > 0) {
            actions.push('Move to cushion: ' + formatCurrency(result.allocations.cushion));
        }

        if (result.allocations.livingMoney > 0) {
            const livingLabel = result.living.mode === 'comfort' ? 'comfort' : 'survival';
            actions.push('Set aside ' + formatCurrency(result.allocations.livingMoney) + ' for ' + livingLabel + ' living money.');
        }

        if (result.tinyCushionOption.eligible && result.tinyCushionOption.choice === 'ask') {
            actions.push('Ask: Continue tiny cushion deposit? Recommended ' + formatCurrency(result.tinyCushionOption.recommendedAmount) + '.');
        }

        if (result.tinyCushionOption.appliedAmount > 0) {
            actions.push('Apply tiny cushion deposit: ' + formatCurrency(result.tinyCushionOption.appliedAmount));
        }

        result.debtAttack.plan.forEach(function (debt) {
            if (debt.extraPaymentCents > 0) {
                actions.push('Send extra debt payment to ' + debt.name + ': ' + formatCurrency(debt.extraPayment));
            }
        });

        if (result.allocations.leftovers > 0) {
            actions.push('Leftover money remains: ' + formatCurrency(result.allocations.leftovers));
        }

        if (result.status === 'survival_underfunded') {
            actions.push('Essentials are still underfunded by ' + formatCurrency(result.summary.uncoveredShortfallAmount) + '.');
        }

        return actions;
    }

    function calculate(input) {
        const scenario = normalizeScenario(input);
        const settings = scenario.settings;
        const mustPayBillsCents = sumCents(scenario.bills, 'amountCents');
        const debtMinimumsCents = sumCents(scenario.debts, 'minimumAppliedCents');
        const mustPayTotalCents = mustPayBillsCents + debtMinimumsCents;

        let availableCents = scenario.incomeCents;
        let status = 'normal';
        let mode = 'normal';
        let livingMode = 'none';
        let cushionMode = 'stair_step';
        let appliedCushionRate = 0;
        let cushionContributionCents = 0;
        let livingMoneyCents = 0;
        let futureBillsCents = 0;
        let uncoveredShortfallCents = 0;

        const futureFundPlans = [];
        const withdrawalGate = {
            triggered: false,
            shortfallAmount: 0,
            shortfallCents: 0,
            recommendedAmount: 0,
            recommendedAmountCents: 0,
            maxAvailableAmount: centsToAmount(scenario.currentCushionBalanceCents),
            maxAvailableCents: scenario.currentCushionBalanceCents,
            canFullyBridge: false
        };

        const tinyCushionOption = {
            eligible: false,
            question: 'Continue tiny cushion deposit?',
            choice: settings.tinyCushionChoice,
            recommendedAmount: 0,
            recommendedAmountCents: 0,
            appliedAmount: 0,
            appliedAmountCents: 0
        };

        availableCents -= mustPayTotalCents;

        if (availableCents < 0) {
            uncoveredShortfallCents = Math.abs(availableCents);
            const bridgeCents = Math.min(uncoveredShortfallCents, scenario.currentCushionBalanceCents);
            withdrawalGate.triggered = bridgeCents > 0;
            withdrawalGate.shortfallCents = uncoveredShortfallCents;
            withdrawalGate.shortfallAmount = centsToAmount(uncoveredShortfallCents);
            withdrawalGate.recommendedAmountCents = bridgeCents;
            withdrawalGate.recommendedAmount = centsToAmount(bridgeCents);
            withdrawalGate.canFullyBridge = bridgeCents >= uncoveredShortfallCents;

            status = withdrawalGate.canFullyBridge ? 'withdrawal_required' : 'hard_stop';
            mode = 'stopped';
            cushionMode = 'paused';
            availableCents = 0;
        } else {
            let futureRemainingCents = availableCents;

            scenario.futureFunds.forEach(function (fund) {
                const fundedCents = Math.min(futureRemainingCents, fund.recommendedContributionCents);
                futureRemainingCents -= fundedCents;
                futureBillsCents += fundedCents;
                futureFundPlans.push({
                    id: fund.id,
                    name: fund.name,
                    targetAmount: centsToAmount(fund.targetAmountCents),
                    currentBalance: centsToAmount(fund.currentBalanceCents),
                    periodsLeft: fund.periodsLeft,
                    remainingNeed: centsToAmount(fund.remainingNeedCents),
                    recommendedContribution: centsToAmount(fund.recommendedContributionCents),
                    fundedContribution: centsToAmount(fundedCents),
                    fundedContributionCents: fundedCents,
                    shortfall: centsToAmount(fund.recommendedContributionCents - fundedCents),
                    shortfallCents: fund.recommendedContributionCents - fundedCents
                });
            });

            availableCents = futureRemainingCents;

            const futureShortfallCents = futureFundPlans.reduce(function (total, plan) {
                return total + plan.shortfallCents;
            }, 0);

            if (futureShortfallCents > 0) {
                status = 'future_bills_short';
                mode = 'stopped';
                cushionMode = 'paused';
                uncoveredShortfallCents = futureShortfallCents;
                availableCents = 0;
            } else {
                const cushionRate = getCushionRate(
                    scenario.currentCushionBalanceCents,
                    settings.cushionTargetCents
                );
                const proposedCushionCents = Math.round(availableCents * cushionRate);
                const afterProposedCushionCents = availableCents - proposedCushionCents;

                if (afterProposedCushionCents >= settings.comfortAmountCents) {
                    status = 'normal';
                    mode = 'normal';
                    livingMode = settings.comfortAmountCents > 0 ? 'comfort' : 'none';
                    appliedCushionRate = cushionRate;
                    cushionContributionCents = proposedCushionCents;
                    cushionMode = cushionRate >= 0.02 && scenario.currentCushionBalanceCents >= settings.cushionTargetCents
                        ? 'maintenance'
                        : 'stair_step';
                    livingMoneyCents = settings.comfortAmountCents;
                    availableCents = afterProposedCushionCents - livingMoneyCents;
                } else if (availableCents >= settings.survivalAmountCents) {
                    status = 'survival_mode';
                    mode = 'survival';
                    livingMode = settings.survivalAmountCents > 0 ? 'survival' : 'none';
                    appliedCushionRate = 0;
                    cushionContributionCents = 0;
                    cushionMode = 'paused';
                    livingMoneyCents = settings.survivalAmountCents;
                    availableCents = availableCents - livingMoneyCents;

                    const thresholdCents = Math.round(settings.survivalAmountCents * settings.tinyCushionAskThreshold);
                    const recommendedTinyCents = Math.min(
                        settings.tinyCushionCapCents,
                        Math.round((livingMoneyCents + availableCents) * settings.tinyCushionPercent),
                        availableCents
                    );

                    if (availableCents > 0 && (livingMoneyCents + availableCents) >= thresholdCents && recommendedTinyCents > 0) {
                        tinyCushionOption.eligible = true;
                        tinyCushionOption.recommendedAmountCents = recommendedTinyCents;
                        tinyCushionOption.recommendedAmount = centsToAmount(recommendedTinyCents);

                        if (settings.tinyCushionChoice === 'yes') {
                            tinyCushionOption.appliedAmountCents = recommendedTinyCents;
                            tinyCushionOption.appliedAmount = centsToAmount(recommendedTinyCents);
                            cushionContributionCents += recommendedTinyCents;
                            cushionMode = 'tiny_applied';
                            availableCents -= recommendedTinyCents;
                        } else {
                            cushionMode = 'tiny_optional';
                        }
                    }
                } else {
                    status = 'survival_underfunded';
                    mode = 'survival';
                    livingMode = availableCents > 0 ? 'partial' : 'none';
                    appliedCushionRate = 0;
                    cushionContributionCents = 0;
                    cushionMode = 'paused';
                    livingMoneyCents = availableCents;
                    uncoveredShortfallCents = Math.max(0, settings.survivalAmountCents - livingMoneyCents);
                    availableCents = 0;
                }
            }
        }

        let debtAttack = {
            strategy: settings.debtStrategyDefault,
            plan: [],
            allocatedCents: 0,
            allocatedAmount: 0,
            leftoversCents: availableCents,
            leftoversAmount: centsToAmount(availableCents)
        };

        if ((status === 'normal' || status === 'survival_mode') && availableCents > 0) {
            debtAttack = distributeDebtAttack(scenario.debts, availableCents, settings.debtStrategyDefault);
            availableCents = debtAttack.leftoversCents;
        }

        const result = {
            version: VERSION,
            status: status,
            mode: mode,
            hardStop: status === 'hard_stop',
            inputs: {
                incomeAmount: centsToAmount(scenario.incomeCents),
                currentCushionBalance: centsToAmount(scenario.currentCushionBalanceCents),
                billCount: scenario.bills.length,
                debtCount: scenario.debts.length,
                futureFundCount: scenario.futureFunds.length,
                activeCadence: settings.activeCadence
            },
            summary: {
                uncoveredShortfallAmount: centsToAmount(uncoveredShortfallCents),
                uncoveredShortfallCents: uncoveredShortfallCents,
                remainingAfterWaterfall: centsToAmount(availableCents),
                remainingAfterWaterfallCents: availableCents
            },
            allocations: {
                mustPayBills: centsToAmount(mustPayTotalCents),
                futureBills: centsToAmount(futureBillsCents),
                cushion: centsToAmount(cushionContributionCents),
                livingMoney: centsToAmount(livingMoneyCents),
                debtAttack: debtAttack.allocatedAmount,
                leftovers: debtAttack.leftoversAmount
            },
            mustPay: {
                billsAmount: centsToAmount(mustPayBillsCents),
                billsAmountCents: mustPayBillsCents,
                debtMinimumsAmount: centsToAmount(debtMinimumsCents),
                debtMinimumsAmountCents: debtMinimumsCents,
                totalAmount: centsToAmount(mustPayTotalCents),
                totalAmountCents: mustPayTotalCents
            },
            futureFunds: {
                totalAmount: centsToAmount(futureBillsCents),
                totalAmountCents: futureBillsCents,
                plans: futureFundPlans
            },
            cushion: {
                currentBalance: centsToAmount(scenario.currentCushionBalanceCents),
                targetAmount: centsToAmount(settings.cushionTargetCents),
                fullnessRatio: settings.cushionTargetCents > 0
                    ? Number((scenario.currentCushionBalanceCents / settings.cushionTargetCents).toFixed(4))
                    : 0,
                appliedRate: appliedCushionRate,
                appliedAmount: centsToAmount(cushionContributionCents),
                appliedAmountCents: cushionContributionCents,
                mode: cushionMode
            },
            living: {
                mode: livingMode,
                allocatedAmount: centsToAmount(livingMoneyCents),
                allocatedAmountCents: livingMoneyCents,
                survivalTarget: centsToAmount(settings.survivalAmountCents),
                comfortTarget: centsToAmount(settings.comfortAmountCents)
            },
            tinyCushionOption: tinyCushionOption,
            withdrawalGate: withdrawalGate,
            debtAttack: debtAttack,
            assumptions: [
                'Future bills are funded before cushion and living money.',
                'Debt minimums are treated as part of Must-Pay Bills.',
                'Tiny cushion deposits are optional and only apply when explicitly chosen.',
                'Any money left after debt attack becomes Leftovers.'
            ]
        };

        result.actionList = buildActionList(result);
        return result;
    }

    function safeCalculate(input) {
        try {
            return {
                ok: true,
                result: calculate(input)
            };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    function demoScenario(overrides) {
        const base = {
            incomeAmount: 1200,
            currentCushionBalance: 300,
            settings: {
                activeCadence: 'paycheck',
                cushionTarget: 1500,
                survivalAmount: 250,
                comfortAmount: 400,
                tinyCushionPercent: 0.01,
                tinyCushionCap: 10,
                tinyCushionChoice: 'ask',
                debtStrategyDefault: 'avalanche'
            },
            bills: [
                { name: 'Rent', amount: 500 },
                { name: 'Utilities', amount: 120 }
            ],
            debts: [
                { name: 'Card A', balance: 900, minPayment: 45, apr: 24.99 },
                { name: 'Card B', balance: 350, minPayment: 30, apr: 18.0 }
            ],
            futureFunds: [
                { name: 'Car Tags', targetAmount: 240, currentBalance: 120, periodsLeft: 6 }
            ]
        };

        return Object.assign({}, base, overrides || {});
    }

    return {
        version: VERSION,
        defaults: DEFAULT_SETTINGS,
        calculate: calculate,
        safeCalculate: safeCalculate,
        demoScenario: demoScenario,
        formatCurrency: formatCurrency
    };
}));
