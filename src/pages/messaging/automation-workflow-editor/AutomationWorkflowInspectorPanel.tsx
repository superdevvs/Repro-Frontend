import { Clock3 } from 'lucide-react';
import { SCHEDULE_TRIGGER_TYPES, type AutomationRecipientRole } from '@/components/messaging/automations/automationWorkflowTypes';
import { getNodePresentation, triggerGroups, triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AutomationRule, MessageChannelConfig, MessageTemplate, WorkflowNode } from '@/types/messaging';
import {
  asJsonObject,
  asString,
  contextRecipientOptions,
  formatDateTime,
  getConditionMatch,
  getConditionRules,
  getContextKey,
  getInternalPriority,
  getRecipientMode,
  getRecipientRoles,
  getScheduleConfig,
  getWaitAmount,
  getWaitUnit,
  recipientRoleOptions,
  ruleOperatorOptions,
  weekdayOptions,
} from './helpers';

interface AutomationWorkflowInspectorPanelProps {
  selectedRawNode: WorkflowNode | null;
  currentAutomation: AutomationRule | null;
  availableVariables: string[];
  isReadOnlyMobile: boolean;
  isStructureLocked: boolean;
  isSystemLocked: boolean;
  emailTemplates: MessageTemplate[];
  smsTemplates: MessageTemplate[];
  emailChannels: MessageChannelConfig[];
  recentRuns: AutomationRule['recent_runs'];
  onDeleteSelectedNode: () => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
}

export function AutomationWorkflowInspectorPanel({
  selectedRawNode,
  currentAutomation,
  availableVariables,
  isReadOnlyMobile,
  isStructureLocked,
  isSystemLocked,
  emailTemplates,
  smsTemplates,
  emailChannels,
  recentRuns,
  onDeleteSelectedNode,
  updateNode,
}: AutomationWorkflowInspectorPanelProps) {
  const conditionRules = getConditionRules(selectedRawNode);
  const recipientMode = getRecipientMode(selectedRawNode);
  const recipientRoles = getRecipientRoles(selectedRawNode, currentAutomation);
  const contextKey = getContextKey(selectedRawNode);
  const scheduleConfig = getScheduleConfig(asJsonObject(selectedRawNode?.config?.schedule));

  const setRecipientRoles = (nextRoles: AutomationRecipientRole[]) => {
    if (!selectedRawNode) return;
    updateNode(selectedRawNode.id, (node) => ({
      ...node,
      config: {
        ...node.config,
        recipientRoles: nextRoles,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Node Inspector</h2>
            <p className="text-xs text-muted-foreground">Configure the selected node and review its validation state.</p>
          </div>
          {selectedRawNode && !String(selectedRawNode.type).startsWith('trigger.') && (
            <Button variant="outline" size="sm" onClick={onDeleteSelectedNode} disabled={isReadOnlyMobile || isStructureLocked}>
              Remove
            </Button>
          )}
        </div>

        {!selectedRawNode ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Select a node from the canvas to configure it.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Selected</div>
              <div className="mt-1 font-medium">{selectedRawNode.id}</div>
              <div className="text-sm text-muted-foreground">{getNodePresentation(selectedRawNode, currentAutomation ?? undefined).label}</div>
            </div>

            {selectedRawNode.type === 'trigger.event' && (
              <div>
                <Label>Trigger Event</Label>
                <Select
                  value={asString(selectedRawNode.config?.triggerType, 'SHOOT_BOOKED')}
                  onValueChange={(value) =>
                    updateNode(selectedRawNode.id, (node) => ({
                      ...node,
                      config: {
                        ...node.config,
                        triggerType: value,
                      },
                    }))
                  }
                  disabled={isReadOnlyMobile}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerGroups.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.triggers.map((trigger) => (
                          <SelectItem key={trigger} value={trigger}>
                            {triggerLabels[trigger] || trigger}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedRawNode.type === 'trigger.schedule' && (
              <div className="space-y-4">
                <div>
                  <Label>Scheduled Trigger Type</Label>
                  <Select
                    value={asString(selectedRawNode.config?.triggerType, 'WEEKLY_AUTOMATED_INVOICING')}
                    onValueChange={(value) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          triggerType: value,
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile || isSystemLocked}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TRIGGER_TYPES.map((trigger) => (
                        <SelectItem key={trigger} value={trigger}>
                          {triggerLabels[trigger]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Day</Label>
                    <Select
                      value={String(scheduleConfig.day_of_week)}
                      onValueChange={(value) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            schedule: {
                              ...getScheduleConfig(asJsonObject(node.config?.schedule)),
                              type: 'weekly',
                              day_of_week: Number(value),
                            },
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile || isSystemLocked}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdayOptions.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={scheduleConfig.time}
                      onChange={(event) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            schedule: {
                              ...getScheduleConfig(asJsonObject(node.config?.schedule)),
                              type: 'weekly',
                              time: event.target.value,
                            },
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile || isSystemLocked}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedRawNode.type === 'condition.if' && (
              <div className="space-y-4">
                <div>
                  <Label>Match Logic</Label>
                  <Select
                    value={getConditionMatch(selectedRawNode)}
                    onValueChange={(value) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          match: value,
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All rules must pass</SelectItem>
                      <SelectItem value="any">Any rule can pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {conditionRules.map((rule, index) => (
                    <div key={`${selectedRawNode.id}-rule-${index}`} className="rounded-2xl border p-3">
                      <div className="grid gap-3">
                        <div>
                          <Label>Context Field</Label>
                          <Input
                            value={rule.field}
                            onChange={(event) => {
                              const nextRules = [...conditionRules];
                              nextRules[index] = { ...nextRules[index], field: event.target.value };
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  rules: nextRules,
                                },
                              }));
                            }}
                            placeholder="status or client.name"
                            disabled={isReadOnlyMobile}
                          />
                        </div>
                        <div>
                          <Label>Operator</Label>
                          <Select
                            value={rule.operator}
                            onValueChange={(value) => {
                              const nextRules = [...conditionRules];
                              nextRules[index] = { ...nextRules[index], operator: value as typeof rule.operator };
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  rules: nextRules,
                                },
                              }));
                            }}
                            disabled={isReadOnlyMobile}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ruleOperatorOptions.map((operator) => (
                                <SelectItem key={operator.value} value={operator.value}>
                                  {operator.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Expected Value</Label>
                          <Input
                            value={rule.value ?? ''}
                            onChange={(event) => {
                              const nextRules = [...conditionRules];
                              nextRules[index] = { ...nextRules[index], value: event.target.value };
                              updateNode(selectedRawNode.id, (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  rules: nextRules,
                                },
                              }));
                            }}
                            placeholder="scheduled"
                            disabled={isReadOnlyMobile}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextRules = [...conditionRules];
                            nextRules.splice(index, 1);
                            updateNode(selectedRawNode.id, (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                rules: nextRules,
                              },
                            }));
                          }}
                          disabled={isReadOnlyMobile}
                        >
                          Remove rule
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          rules: [...conditionRules, { field: '', operator: 'eq', value: '' }],
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile}
                  >
                    Add Rule
                  </Button>
                  <div className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
                    Condition nodes need both a <strong>true</strong> and a <strong>false</strong> branch connected from the bottom handles.
                  </div>
                </div>
              </div>
            )}

            {selectedRawNode.type === 'wait.duration' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="1"
                    value={getWaitAmount(selectedRawNode, 30)}
                    onChange={(event) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          amount: Number(event.target.value),
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select
                    value={getWaitUnit(selectedRawNode, 'minutes')}
                    onValueChange={(value) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          unit: value,
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {selectedRawNode.type === 'wait.datetime_offset' && (
              <div className="space-y-4">
                <div>
                  <Label>Reference Field</Label>
                  <Input
                    value={asString(selectedRawNode.config?.referenceField, 'shoot_datetime')}
                    onChange={(event) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          referenceField: event.target.value,
                        },
                      }))
                    }
                    placeholder="shoot_datetime"
                    disabled={isReadOnlyMobile}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Direction</Label>
                    <Select
                      value={asString(selectedRawNode.config?.direction, 'before')}
                      onValueChange={(value) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            direction: value,
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before</SelectItem>
                        <SelectItem value="after">After</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="1"
                      value={getWaitAmount(selectedRawNode, 24)}
                      onChange={(event) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            amount: Number(event.target.value),
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select
                      value={getWaitUnit(selectedRawNode, 'hours')}
                      onValueChange={(value) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            unit: value,
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            {(selectedRawNode.type === 'action.email' || selectedRawNode.type === 'action.sms' || selectedRawNode.type === 'action.internal_notification') && (
              <div className="space-y-4">
                <div>
                  <Label>Recipient Source</Label>
                  <Select
                    value={recipientMode}
                    onValueChange={(value) =>
                      updateNode(selectedRawNode.id, (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          recipientMode: value,
                        },
                      }))
                    }
                    disabled={isReadOnlyMobile}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automation_default">Use automation default roles</SelectItem>
                      <SelectItem value="roles">Choose roles here</SelectItem>
                      <SelectItem value="context">Use a contact from workflow context</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recipientMode === 'roles' && (
                  <div className="space-y-2">
                    <Label>Recipient Roles</Label>
                    {recipientRoleOptions.map((role) => (
                      <div key={`${selectedRawNode.id}-${role.value}`} className="flex items-center gap-2">
                        <Checkbox
                          checked={recipientRoles.includes(role.value)}
                          onCheckedChange={(checked) => {
                            const nextRoles = new Set(recipientRoles);
                            if (checked) {
                              nextRoles.add(role.value);
                            } else {
                              nextRoles.delete(role.value);
                            }
                            setRecipientRoles(Array.from(nextRoles));
                          }}
                          disabled={isReadOnlyMobile}
                        />
                        <Label>{role.label}</Label>
                      </div>
                    ))}
                  </div>
                )}

                {recipientMode === 'context' && (
                  <div>
                    <Label>Context Contact</Label>
                    <Select
                      value={contextKey}
                      onValueChange={(value) =>
                        updateNode(selectedRawNode.id, (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            contextKey: value,
                          },
                        }))
                      }
                      disabled={isReadOnlyMobile}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contextRecipientOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedRawNode.type === 'action.email' && (
                  <>
                    <div>
                      <Label>Email Template</Label>
                      <Select
                        value={selectedRawNode.config?.templateId ? String(selectedRawNode.config.templateId) : 'none'}
                        onValueChange={(value) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              templateId: value === 'none' ? null : Number(value),
                            },
                          }))
                        }
                        disabled={isReadOnlyMobile}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Inline email only</SelectItem>
                          {emailTemplates.map((template) => (
                            <SelectItem key={template.id} value={String(template.id)}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Email Channel</Label>
                      <Select
                        value={selectedRawNode.config?.channelId ? String(selectedRawNode.config.channelId) : 'default'}
                        onValueChange={(value) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              channelId: value === 'default' ? null : Number(value),
                            },
                          }))
                        }
                        disabled={isReadOnlyMobile}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Use default channel</SelectItem>
                          {emailChannels.map((channel) => (
                            <SelectItem key={channel.id} value={String(channel.id)}>
                              {channel.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject</Label>
                      <Input
                        value={asString(selectedRawNode.config?.subject)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              subject: event.target.value,
                            },
                          }))
                        }
                        placeholder="Optional if template handles the subject"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                    <div>
                      <Label>HTML Body</Label>
                      <Textarea
                        value={asString(selectedRawNode.config?.bodyHtml)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              bodyHtml: event.target.value,
                            },
                          }))
                        }
                        rows={5}
                        placeholder="<p>Hello {{client.name}}</p>"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                    <div>
                      <Label>Plain Text Body</Label>
                      <Textarea
                        value={asString(selectedRawNode.config?.bodyText)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              bodyText: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        placeholder="Hello {{client.name}}"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                  </>
                )}

                {selectedRawNode.type === 'action.sms' && (
                  <>
                    <div>
                      <Label>SMS Template</Label>
                      <Select
                        value={selectedRawNode.config?.templateId ? String(selectedRawNode.config.templateId) : 'none'}
                        onValueChange={(value) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              templateId: value === 'none' ? null : Number(value),
                            },
                          }))
                        }
                        disabled={isReadOnlyMobile}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Inline SMS only</SelectItem>
                          {smsTemplates.map((template) => (
                            <SelectItem key={template.id} value={String(template.id)}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>SMS Body</Label>
                      <Textarea
                        value={asString(selectedRawNode.config?.bodyText)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              bodyText: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        placeholder="Your shoot is tomorrow at {{shoot_datetime}}"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                  </>
                )}

                {selectedRawNode.type === 'action.internal_notification' && (
                  <>
                    <div>
                      <Label>Notification Title</Label>
                      <Input
                        value={asString(selectedRawNode.config?.title)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              title: event.target.value,
                            },
                          }))
                        }
                        placeholder="Review payment issue"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                    <div>
                      <Label>Message Body</Label>
                      <Textarea
                        value={asString(selectedRawNode.config?.body)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              body: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        placeholder="Take action for {{shoot_address}}"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                    <div>
                      <Label>Destination Link</Label>
                      <Input
                        value={asString(selectedRawNode.config?.destinationUrl)}
                        onChange={(event) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              destinationUrl: event.target.value,
                            },
                          }))
                        }
                        placeholder="/shoot-history"
                        disabled={isReadOnlyMobile}
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={getInternalPriority(selectedRawNode)}
                        onValueChange={(value) =>
                          updateNode(selectedRawNode.id, (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              priority: value,
                            },
                          }))
                        }
                        disabled={isReadOnlyMobile}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedRawNode.type === 'end' && (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                End nodes terminate a branch cleanly. Use them after optional paths or to satisfy a condition branch that should stop.
              </div>
            )}

            <div className="rounded-2xl border p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Allowed Variables</div>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <Badge key={`${selectedRawNode.id}-${variable}`} variant="secondary">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Recent Runs</h2>
            <p className="text-xs text-muted-foreground">Execution health for this workflow.</p>
          </div>
          <Clock3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-4 space-y-3">
          {(recentRuns ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No execution history yet.</div>
          ) : (
            (recentRuns ?? []).slice(0, 5).map((run) => (
              <div key={run.id} className="rounded-2xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Run #{run.id}</div>
                  <Badge
                    className={
                      run.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : run.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : run.status === 'waiting'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Started {formatDateTime(run.started_at)}</div>
                {run.error_message && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">{run.error_message}</div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
