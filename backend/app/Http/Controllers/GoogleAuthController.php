<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        if (! config('services.google.client_id') || ! config('services.google.client_secret')) {
            abort(404);
        }

        $return = $this->validatedReturnUrl($request->query('return'));
        $request->session()->put('google_oauth_return', $return);

        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        if (! config('services.google.client_id') || ! config('services.google.client_secret')) {
            abort(404);
        }

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['message' => $e->getMessage()]);

            return $this->errorRedirect('Google sign-in failed. Try again.');
        }

        $googleId = (string) $googleUser->getId();
        $email = $googleUser->getEmail();
        if ($email === null || $email === '') {
            return $this->errorRedirect('Google did not return an email address.');
        }

        $user = User::query()->where('google_id', $googleId)->first();

        if (! $user) {
            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [mb_strtolower($email)])
                ->first();

            if ($user) {
                if ($user->google_id !== null && $user->google_id !== $googleId) {
                    return $this->errorRedirect('This email is linked to a different Google account.');
                }
                $user->google_id = $googleId;
                if ($user->email_verified_at === null) {
                    $user->email_verified_at = now();
                }
            } else {
                $user = User::query()->create([
                    'name' => $googleUser->getName() ?: (strstr($email, '@', true) ?: 'User'),
                    'email' => $email,
                    'google_id' => $googleId,
                    'password' => null,
                    'role' => 'USER',
                    'email_verified_at' => now(),
                    'image' => $googleUser->getAvatar() ?: null,
                ]);
            }
        }

        $avatar = $googleUser->getAvatar();
        if ($avatar && ($user->image === null || $user->image === '' || preg_match('#^https?://#i', (string) $user->image))) {
            $user->image = $avatar;
        }
        if ($user->isDirty()) {
            $user->save();
        }

        $user->tokens()->delete();
        $token = $user->createToken('spa')->plainTextToken;

        $return = $request->session()->pull('google_oauth_return', $this->frontendCallbackDefault());
        $sep = str_contains($return, '?') ? '&' : '?';
        $target = $return.$sep.'token='.rawurlencode($token);

        return redirect()->away($target);
    }

    private function errorRedirect(string $message): RedirectResponse
    {
        $base = $this->frontendCallbackDefault();
        $sep = str_contains($base, '?') ? '&' : '?';

        return redirect()->away($base.$sep.'error='.rawurlencode($message));
    }

    private function frontendCallbackDefault(): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/auth/callback';
    }

    private function validatedReturnUrl(mixed $return): string
    {
        $default = $this->frontendCallbackDefault();
        if (! is_string($return) || $return === '') {
            return $default;
        }
        if (filter_var($return, FILTER_VALIDATE_URL) === false) {
            return $default;
        }
        $prefix = $default;
        if ($return === $prefix || str_starts_with($return, $prefix.'?')) {
            return $return;
        }

        return $default;
    }
}
