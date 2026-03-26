<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\BannerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function providers(): JsonResponse
    {
        return response()->json([
            'google' => (bool) (config('services.google.client_id') && config('services.google.client_secret')),
            'oidc' => (bool) (config('services.oidc.issuer') && config('services.oidc.client_id') && config('services.oidc.client_secret')),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => 'USER',
        ]);

        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user, $request),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (! $user || $user->password === null || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => [
                    $user && $user->password === null
                        ? 'This account uses Google sign-in.'
                        : 'Invalid email or password.',
                ],
            ]);
        }

        $user->tokens()->delete();
        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user, $request),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user(), $request));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'avatar' => ['nullable', 'file', 'image', 'max:2048', 'mimes:jpeg,jpg,png,gif,webp'],
            'remove_avatar' => ['sometimes', 'boolean'],
            'external_image_url' => ['sometimes', 'string', 'max:2048'],
            'current_password' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        if (! empty($data['password'])) {
            if ($user->password !== null && $user->password !== '') {
                if (! Hash::check($data['current_password'] ?? '', $user->password)) {
                    throw ValidationException::withMessages([
                        'current_password' => ['The current password is incorrect.'],
                    ]);
                }
            }
            $user->password = $data['password'];
        }

        $user->name = $data['name'];
        $user->email = $data['email'];

        if ($request->boolean('remove_avatar')) {
            $this->deleteLocalProfileImage($user->image);
            $user->image = null;
        } elseif ($request->hasFile('avatar')) {
            $this->deleteLocalProfileImage($user->image);
            $user->image = $request->file('avatar')->store('profile-uploads', 'public');
        } elseif ($request->exists('external_image_url')) {
            $ext = trim((string) ($data['external_image_url'] ?? ''));
            if ($ext !== '' && ! filter_var($ext, FILTER_VALIDATE_URL)) {
                throw ValidationException::withMessages([
                    'external_image_url' => ['Enter a valid image URL.'],
                ]);
            }
            if ($ext === '') {
                if ($user->image && preg_match('#^https?://#i', $user->image)) {
                    $user->image = null;
                }
            } else {
                $this->deleteLocalProfileImage($user->image);
                $user->image = $ext;
            }
        }

        $user->save();

        return response()->json($this->userPayload($user->fresh(), $request));
    }

    private function deleteLocalProfileImage(?string $stored): void
    {
        if ($stored === null || $stored === '' || preg_match('#^https?://#i', $stored)) {
            return;
        }
        Storage::disk('public')->delete($stored);
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(?User $user, ?Request $request = null): array
    {
        if (! $user) {
            return [];
        }

        $raw = $user->image;
        $external = ($raw !== null && $raw !== '' && preg_match('#^https?://#i', $raw)) ? $raw : null;
        $root = $request?->root();

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'image' => BannerService::publicImageUrl($raw, $root),
            'externalImageUrl' => $external,
            'role' => $user->role ?? 'USER',
        ];
    }
}
