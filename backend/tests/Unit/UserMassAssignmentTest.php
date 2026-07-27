<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Mengunci invarian keamanan: kolom penentu hak akses tidak boleh ikut terisi
 * lewat mass assignment. Tanpa ini, satu `fill()`/`update($request->all())`
 * yang lalai di endpoint mana pun langsung jadi jalur eskalasi hak.
 */
final class UserMassAssignmentTest extends TestCase
{
    public static function privilegeColumns(): array
    {
        return [
            'role' => ['role', 'admin'],
            'status' => ['status', 'aktif'],
            'google_id' => ['google_id', 'penyerang-google-id'],
        ];
    }

    #[DataProvider('privilegeColumns')]
    public function test_privilege_column_is_never_mass_assignable(string $column, string $value): void
    {
        self::assertFalse(
            (new User)->isFillable($column),
            "Kolom '{$column}' tidak boleh ada di \$fillable User.",
        );

        $user = (new User)->fill(['name' => 'Penyusup', $column => $value]);

        self::assertSame('Penyusup', $user->name);
        self::assertNull($user->{$column});
    }
}
