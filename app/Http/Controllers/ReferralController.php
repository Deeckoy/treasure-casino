<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Models\ReferralProfit;
use App\Models\User;

use DB;

class ReferralController extends Controller
{
    public function init()
    {
        $referral_lvl_1_list = User::where('referral_use', $this->user->id)
            ->select('id')
            ->get();

        $ref_percent = $this->user->referral_percent
            ? $this->user->referral_percent
            : $this->config->referral_percent;

        return [
            'ref_percent' => $ref_percent,
            'ref_count' => count($referral_lvl_1_list),
            'ref_profit' => ReferralProfit::whereIn('from_id', $referral_lvl_1_list)->where('level', 1)->sum('amount'),
            'link' => $this->config->referral_domain . '/r/' . $this->user->unique_id
        ];
    }

    public function setReferral($unique_id)
    {
        Session(['ref' => $unique_id]);
        return redirect('/');
    }
}
