import type Echo from 'laravel-echo';

declare global {
  interface Window {
    Pusher?: any;
    Echo?: Echo;
  }
}

export {};

