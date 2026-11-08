DUSTLINE: EXTRACTION 3D v0.4 — 改良試作版

起動: このフォルダで python3 -m http.server 8080 を実行し、http://localhost:8080/ を開く。
友達向け: ユーザーの公開承認後に、このフォルダをHTTPS静的ホスティングへ配置。
index.htmlが公開ルートにある構成。ビルド・サーバーAPI・登録・アプリ不要。
HTMLをファイルアプリで直接開く方法は対象外。WebGL2が必要。

操作: PCはWASD/Shift移動、マウスドラッグ視点、左長押し/F射撃、右長押し照準、E回収、R装填、H治療、Esc停止。
iPhoneは左ドラッグ移動、右スワイプ視点、射撃長押し、各ボタンを操作。
物資を3個回収し、北側ゲートで脱出する。

服・装備・機械・建物配置は独自制作。表面素材とHDRIはPoly Haven（CC0）、頭部はMakeHumanのCC0人体ベースを使用。Three.jsはMITライセンス（vendor/THREE-LICENSE.txt）。
models/のGLBは編集・閲覧用で、実行時はmodels.jsから生成する。
preview.htmlでモデルと動作を確認できる。

iPhone実機Safariは未検証。30fps達成未確認。写実的な商用大作と同等ではない。
この納品時点では外部公開していない。詳細・試験結果・実機手順はソース一式のdocs/を参照。
