import { writable } from 'svelte/store';

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
    duration?: number;
}

function createNotificationStore() {
    const { subscribe, update } = writable<Notification[]>([]);

    return {
        subscribe,
        add: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
            const id = Math.random().toString(36).substr(2, 9);
            const newNotification: Notification = {
                ...notification,
                id,
                timestamp: new Date(),
                duration: notification.duration ?? 5000
            };

            update(notifications => [...notifications, newNotification]);

            // Auto-remove after duration
            const duration = newNotification.duration ?? 5000;
            if (duration > 0) {
                setTimeout(() => {
                    update(notifications => 
                        notifications.filter(n => n.id !== id)
                    );
                }, duration);
            }
        },
        remove: (id: string) => {
            update(notifications => 
                notifications.filter(n => n.id !== id)
            );
        },
        clear: () => {
            update(() => []);
        }
    };
}

export const notifications = createNotificationStore();