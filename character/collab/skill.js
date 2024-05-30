import { lib, game, ui, get, ai, _status } from "../../noname.js";

/** @type { importCharacterConfig['skill'] } */
const skills = {
	//会玩孙权
	dchuiwan: {
		audio: 2,
		trigger: { player: "drawBegin" },
		filter(event, player) {
			return lib.inpile.some(name => {
				const type = get.type(name);
				if (type != "basic" && type != "trick") return false;
				return !player.getStorage("dchuiwan_used").includes(name);
			});
		},
		async cost(event, trigger, player) {
			let result = await player
				.chooseButton(
					[
						get.prompt2("dchuiwan"),
						[
							lib.inpile.filter(name => {
								const type = get.type(name);
								if (type != "basic" && type != "trick") return false;
								return !player.getStorage("dchuiwan_used").includes(name);
							}),
							"vcard",
						],
					],
					[1, trigger.num]
				)
				.set("ai", button => {
					if (!get.cardPile2(button.link[2])) return 0;
					return get.value({ name: button.link }, get.event("player"));
				})
				.forResult();
			if (result.bool) {
				result.cost_data = result.links;
			}
			event.result = result;
		},
		async content(event, trigger, player) {
			trigger.cancel();
			if (!player.storage.dchuiwan_used) {
				player.when({ global: "phaseAfter" }).then(() => delete player.storage.dchuiwan_used);
			}
			player.markAuto(
				"dchuiwan_used",
				event.cost_data.map(name => name[2])
			);
			let list = [];
			for (const name of event.cost_data) {
				const card = get.cardPile2(name[2]);
				if (card) list.push(card);
			}
			if (list.length) await player.gain(list, "gain2");
			else player.chat("无牌可得？！");
		},
	},
	dchuanli: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return (
				player.getHistory("useCard", evt => {
					return (evt.targets || []).includes(player);
				}).length >= 3 ||
				game.hasPlayer(target => {
					if (target == player) return false;
					return (
						player.getHistory("useCard", evt => {
							return (evt.targets || []).includes(target);
						}).length >= 3
					);
				})
			);
		},
		direct: true,
		async content(event, trigger, player) {
			let zhangzhang = false,
				zhouyu = false;
			if (
				player.getHistory("useCard", evt => {
					return (evt.targets || []).includes(player);
				}).length >= 3
			) {
				const result = await player
					.chooseTarget(get.prompt("dchuanli"), "令一名其他角色的所有技能失效，然后令其获得〖直谏〗和〖固政〗直到其回合结束", (card, player, target) => {
						return target != player && !target.hasSkill("dchuanli_zhangzhang");
					})
					.set("ai", target => {
						const player = get.event("player");
						return (
							get.rank("zhangzhang", true) -
							["name", "name1", "name2"].reduce((sum, name) => {
								if (!target[name] || !lib.character[target[name]] || (name == "name1" && target.name1 == target.name)) return sum;
								return sum + get.rank(target[name], true);
							}, 0)
						);
					})
					.forResult();
				if (result.bool) {
					zhangzhang = true;
					const target = result.targets[0];
					await player.logSkill("dchuanli", target);
					target.addTempSkill("dchuanli_zhangzhang", { player: "phaseAfter" });
					target.markSkillCharacter("dchuanli_zhangzhang", "zhangzhang", "唤理-内事", "内事不决问张昭");
					await target.addAdditionalSkills("dchuanli_zhangzhang", ["zhijian", "guzheng"]);
				}
			}
			const targets = game.filterPlayer(target => {
				if (target == player || target.hasSkill("dchuanli_zhouyu")) return false;
				return (
					player.getHistory("useCard", evt => {
						return (evt.targets || []).includes(target);
					}).length >= 3
				);
			});
			if (targets.length) {
				const result = await player
					.chooseTarget(get.prompt("dchuanli"), "令一名其他角色的所有技能失效，然后令其获得〖直谏〗和〖固政〗直到其回合结束", (card, player, target) => {
						return get.event("targets").includes(target);
					})
					.set("ai", target => {
						const player = get.event("player");
						return (
							get.rank("re_zhouyu", true) -
							["name", "name1", "name2"].reduce((sum, name) => {
								if (!target[name] || !lib.character[target[name]] || (name == "name1" && target.name1 == target.name)) return sum;
								return sum + get.rank(target[name], true);
							}, 0)
						);
					})
					.set("targets", targets)
					.forResult();
				if (result.bool) {
					zhouyu = true;
					const target = result.targets[0];
					await player.logSkill("dchuanli", target);
					target.addTempSkill("dchuanli_zhouyu", { player: "phaseAfter" });
					target.markSkillCharacter("dchuanli_zhouyu", "re_zhouyu", "唤理-外事", "外事不决问周瑜");
					await target.addAdditionalSkills("dchuanli_zhouyu", ["reyingzi", "refanjian"]);
				}
			}
			if (zhangzhang && zhouyu) {
				await player.logSkill("dchuanli");
				if (player.storage.dchuanli_sunquan) delete player.storage.dchuanli_sunquan;
				await player.addAdditionalSkills("dchuanli_sunquan", "rezhiheng");
				player.addSkill("dchuanli_sunquan");
			}
		},
		subSkill: {
			zhangzhang: {
				init(player, skill) {
					player.addSkillBlocker(skill);
				},
				onremove(player, skill) {
					player.removeSkillBlocker(skill);
					player.removeAdditionalSkills(skill);
				},
				charlotte: true,
				skillBlocker(skill) {
					return !["zhijian", "guzheng"].includes(skill) && skill != "dchuanli_zhangzhang" && !lib.skill[skill].charlotte;
				},
			},
			zhouyu: {
				init(player, skill) {
					player.addSkillBlocker(skill);
				},
				onremove(player, skill) {
					player.removeSkillBlocker(skill);
					player.removeAdditionalSkills(skill);
				},
				charlotte: true,
				skillBlocker(skill) {
					return !["reyingzi", "refanjian"].includes(skill) && skill != "dchuanli_zhouyu" && !lib.skill[skill].charlotte;
				},
			},
			sunquan: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
				},
				trigger: { player: "phaseAfter" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					if (!player.storage.dchuanli_sunquan) {
						player.storage.dchuanli_sunquan = true;
					} else {
						await player.removeAdditionalSkills("dchuanli_sunquan");
						player.removeSkill("dchuanli_sunquan");
					}
				},
			},
		},
		derivation: ["zhijian", "guzheng", "reyingzi", "refanjian", "rezhiheng"],
	},
	//屈原
	dcqiusuo: {
		audio: 2,
		trigger: { source: "damageSource" },
		frequent: true,
		async content(event, trigger, player) {
			const tiesuo = get.cardPile("tiesuo");
			if (tiesuo) await player.gain(tiesuo, "gain2");
		},
	},
	dclisao: {
		audio: 2,
		enable: "phaseUse",
		filterTarget: true,
		selectTarget: [1, 2],
		usable: 1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			let targets = event.targets.sortBySeat();
			//处理问题
			let answer = [],
				gaifa = targets.slice(); //该罚
			let question = [];
			const sentences = _status.lisao_text.randomGets(2).randomSort();
			const goon = Math.round(Math.random());
			question.addArray(["请回答《离骚》中“" + sentences[0].split("，")[goon] + "”的" + (goon ? "上" : "下") + "句", [sentences[0].split("，")[1 - goon], sentences[1].split("，")[1 - goon]].randomSort()]);
			//人类和AI
			//AI随机排序一下，模拟不同顺序回答
			let humans = targets.filter(current => current === game.me || current.isOnline());
			let locals = targets.slice(0).randomSort();
			locals.removeArray(humans);
			const eventId = get.id();
			const send = (question, current, eventId) => {
				lib.skill.dclisao.chooseControl(question, current, eventId);
				game.resume();
			};
			//让读条不消失并显示读条
			event._global_waiting = true;
			let time = 10000;
			if (lib.configOL && lib.configOL.choose_timeout) time = parseInt(lib.configOL.choose_timeout) * 1000;
			targets.forEach(current => current.showTimer(time));
			//先处理人类玩家
			if (humans.length > 0) {
				const solve = function (resolve, reject) {
					return function (result, player) {
						if (result && result.control) {
							resolve();
							answer.push([player, result.control]);
						} else reject();
					};
				};
				await Promise.any(
					humans.map(current => {
						return new Promise(async (resolve, reject) => {
							if (current.isOnline()) {
								current.send(send, question, current, eventId);
								current.wait(solve(resolve, reject));
							} else {
								const next = lib.skill.dclisao.chooseControl(question, current, eventId);
								const solver = solve(resolve, reject);
								if (_status.connectMode) game.me.wait(solver);
								const result = await next.forResult();
								if (_status.connectMode) game.me.unwait(result, current);
								else solver(result, current);
							}
						});
					})
				).catch(() => {});
				game.broadcastAll("cancel", eventId);
			}
			//再处理单机的他人控制玩家/AI玩家
			if (locals.length > 0) {
				for (let current of locals) {
					const result = await lib.skill.dclisao.chooseControl(question, current).forResult();
					if (result && result.control) {
						answer.push([current, result.control]);
					}
				}
			}
			//清除读条
			delete event._global_waiting;
			for (let i of targets) i.hideTimer();
			//处理结果
			if (answer.length) {
				let show = false;
				for (const list of answer) {
					list[0].chat(list[1]);
					game.log(list[0], "的答案为", "#y" + list[1]);
					if (list[1] == sentences[0].split("，")[1 - goon]) {
						list[0].popup("回答正确", "wood");
						game.log(list[0], "回答正确");
						if (!show) {
							show = true;
							if (list[0].countCards("h")) {
								await list[0].showHandcards();
							}
						}
						gaifa.remove(list[0]);
					} else {
						list[0].popup("回答错误", "fire");
						game.log(list[0], "回答错误");
					}
				}
				await game.asyncDelay();
			}
			if (gaifa.length) {
				for (const i of gaifa) {
					i.addTempSkill("dclisao_gaifa");
				}
			}
		},
		chooseControl(question, current, eventId) {
			const next = current.chooseControl(question[1]);
			next.set("prompt", question[0]);
			next.set("id", eventId);
			next.set("_global_waiting", true);
			next.set("ai", () => Math.round(Math.random()));
			return next;
		},
		init() {
			//《离骚》（高中节选）
			if (!_status.lisao_text) {
				let text = "长太息以掩涕兮，哀民生之多艰。余虽好修姱以鞿羁兮，謇朝谇而夕替。既替余以蕙纕兮，又申之以揽茝。亦余心之所善兮，虽九死其犹未悔。怨灵修之浩荡兮，终不察夫民心。众女嫉余之蛾眉兮，谣诼谓余以善淫。固时俗之工巧兮，偭规矩而改错。背绳墨以追曲兮，竞周容以为度。忳郁邑余侘傺兮，吾独穷困乎此时也。宁溘死以流亡兮，余不忍为此态也。鸷鸟之不群兮，自前世而固然。何方圜之能周兮，夫孰异道而相安。屈心而抑志兮，忍尤而攘诟。伏清白以死直兮，固前圣之所厚。悔相道之不察兮，延伫乎吾将反。回朕车以复路兮，及行迷之未远。步余马于兰皋兮，驰椒丘且焉止息。进不入以离尤兮，退将复修吾初服。制芰荷以为衣兮，集芙蓉以为裳。不吾知其亦已兮，苟余情其信芳。高余冠之岌岌兮，长余佩之陆离。芳与泽其杂糅兮，唯昭质其犹未亏。忽反顾以游目兮，将往观乎四荒。佩缤纷其繁饰兮，芳菲菲其弥章。民生各有所乐兮，余独好修以为常。虽体解吾犹未变兮，岂余心之可惩。";
				_status.lisao_text = text.slice(0, -1).split("。");
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (target.hasSkill("dclisao_gaifa")) return 0;
					if (get.damageEffect(target, player, player) < 0 && get.attitude(player, target) > 0) return 0;
					let cards = player.getCards("hs", card => get.tag(card, "damage") && player.canUse(card, target) && get.effect(target, card, player, player) > 0);
					if (!cards.length) return 0;
					let cardx = cards.filter(card => get.name(card) == "sha");
					cardx.sort((a, b) => get.effect(target, b, player, player) - get.effect(target, a, player, player));
					cardx = cardx.slice(Math.min(cardx.length, player.getCardUsable("sha")), cardx.length);
					cards.removeArray(cardx);
					return -cards.reduce((sum, card) => sum + get.effect(target, card, player, player), 0) - 10;
				},
			},
		},
		subSkill: {
			gaifa: {
				charlotte: true,
				trigger: { player: "damageBegin3" },
				filter(event, player) {
					return player.getHistory("damage", evt => evt.num > 0).length;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.num = player.getHistory("damage", evt => evt.num > 0).lastItem.num * 2;
				},
				mark: true,
				marktext: "江",
				intro: { content: "不能熟记《离骚》的惩罚——本回合受到伤害时，若你本回合已受到过伤害，则此伤害值改为上一次受到的伤害的两倍" },
			},
		},
	},
	//名将吴懿
	dcbenxi: {
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		zhuanhuanji: true,
		filter(event, player) {
			const evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		async content(event, trigger, player) {
			player.changeZhuanhuanji("dcbenxi");
			if (player.storage.dcbenxi) {
				const map = lib.skill.dcbenxi.getMap(),
					list = Object.keys(map);
				if (list.length > 0) {
					const skill = list.randomGet(),
						voiceMap = game.parseSkillTextMap(skill, map[skill]);
					player.storage.dcbenxi_pending = skill;
					findaudio: for (let data of voiceMap) {
						if (!data.text) continue;
						const pinyins = get.pinyin(data.text, false);
						for (let i = 0; i < pinyins.length - 1; i++) {
							if (pinyins[i] === "wu" && pinyins[i + 1] === "yi") {
								player.chat(data.text);
								game.broadcastAll(file => game.playAudio(file), data.file);
								break findaudio;
							}
						}
					}
				}
			} else {
				const skill = player.storage.dcbenxi_pending;
				if (skill) {
					if (player.hasSkill(skill, null, false)) {
						const targets = game.filterPlayer(current => current != player).sortBySeat();
						player.line(targets, "fire");
						for (let target of targets) {
							if (target.isIn()) await target.damage();
						}
					} else {
						await player.addTempSkills([skill], { player: "phaseBegin" });
					}
					delete player.storage.dcbenxi_pending;
				}
			}
		},
		onremove(player) {
			delete player.storage.dcbenxi;
			delete player.storage.dcbenxi_pending;
		},
		mark: true,
		marktext: "☯",
		intro: {
			mark(dialog, storage, player) {
				if (storage) {
					const skill = player.storage.dcbenxi_pending;
					if (skill) {
						dialog.addText(`锁定技，当你下次失去手牌后，你获得技能〖${get.translation(skill)}〗直到你的下回合开始。若已获得该技能，则改为对所有其他角色各造成1点伤害。`, false);
						dialog.add('<div><div class="skill">【' + get.translation(lib.translate[skill + "_ab"] || get.translation(skill).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(skill, player) + "</div></div>");
					}
				} else {
					return "锁定技。当你下次失去手牌后，你随机念出一句拼音中含有“wu,yi”的台词。";
				}
			},
		},
		getMap() {
			if (!_status.dcbenxi_map) {
				_status.dcbenxi_map = {};
				let list;
				if (_status.connectMode) {
					list = get.charactersOL();
				} else {
					list = get.gainableCharacters();
				}
				list.forEach(name => {
					if (name !== "dc_wuyi") {
						const skills = get.character(name, 3);
						skills.forEach(skill => {
							const info = get.info(skill);
							if (!info || (info.ai && info.ai.combo)) return;
							if (skill in _status.dcbenxi_map) return;
							const voices = game.parseSkillText(skill, name);
							if (
								voices.some(text => {
									const pinyins = get.pinyin(text, false);
									for (let i = 0; i < pinyins.length - 1; i++) {
										if (pinyins[i] === "wu" && pinyins[i + 1] === "yi") return true;
									}
									return false;
								})
							) {
								_status.dcbenxi_map[skill] = name;
							}
						});
					}
				});
			}
			return _status.dcbenxi_map;
		},
	},
	//新InitFilter测试高达一号
	//打赢复活赛的牢达[哭]
	dclonghun: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		prompt: "将♦牌当做火【杀】，♥牌当做【桃】，♣牌当做【闪】，♠牌当做【无懈可击】使用或打出",
		viewAs(cards, player) {
			var name;
			var nature = null;
			switch (get.suit(cards[0], player)) {
				case "club":
					name = "shan";
					break;
				case "diamond":
					name = "sha";
					nature = "fire";
					break;
				case "spade":
					name = "wuxie";
					break;
				case "heart":
					name = "tao";
					break;
			}
			if (name) return { name: name, nature: nature };
			return null;
		},
		check(card) {
			var player = _status.event.player;
			if (_status.event.type == "phase") {
				var max = 0;
				var name2;
				var list = ["sha", "tao"];
				var map = { sha: "diamond", tao: "heart" };
				for (var i = 0; i < list.length; i++) {
					var name = list[i];
					if (
						player.countCards("hes", function (card) {
							return (name != "sha" || get.value(card) < 5) && get.suit(card, player) == map[name];
						}) > 0 &&
						player.getUseValue({
							name: name,
							nature: name == "sha" ? "fire" : null,
						}) > 0
					) {
						var temp = get.order({
							name: name,
							nature: name == "sha" ? "fire" : null,
						});
						if (temp > max) {
							max = temp;
							name2 = map[name];
						}
					}
				}
				if (name2 == get.suit(card, player)) return name2 == "diamond" ? 5 - get.value(card) : 20 - get.value(card);
				return 0;
			}
			return 1;
		},
		position: "hes",
		filterCard(card, player, event) {
			event = event || _status.event;
			var filter = event._backup.filterCard;
			var name = get.suit(card, player);
			if (name == "club" && filter({ name: "shan", cards: [card] }, player, event)) return true;
			if (name == "diamond" && filter({ name: "sha", cards: [card], nature: "fire" }, player, event)) return true;
			if (name == "spade" && filter({ name: "wuxie", cards: [card] }, player, event)) return true;
			if (name == "heart" && filter({ name: "tao", cards: [card] }, player, event)) return true;
			return false;
		},
		filter(event, player) {
			var filter = event.filterCard;
			if (filter(get.autoViewAs({ name: "sha", nature: "fire" }, "unsure"), player, event) && player.countCards("hes", { suit: "diamond" })) return true;
			if (filter(get.autoViewAs({ name: "shan" }, "unsure"), player, event) && player.countCards("hes", { suit: "club" })) return true;
			if (filter(get.autoViewAs({ name: "tao" }, "unsure"), player, event) && player.countCards("hes", { suit: "heart" })) return true;
			if (filter(get.autoViewAs({ name: "wuxie" }, "unsure"), player, event) && player.countCards("hes", { suit: "spade" })) return true;
			return false;
		},
		usable: 20,
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				if ((player.getStat("skill").dclonghun || 0) >= 20) return false;
				var name;
				switch (tag) {
					case "respondSha":
						name = "diamond";
						break;
					case "respondShan":
						name = "club";
						break;
					case "save":
						name = "heart";
						break;
				}
				if (!player.countCards("hes", { suit: name })) return false;
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var max = 0;
					var list = ["sha", "tao"];
					var map = { sha: "diamond", tao: "heart" };
					for (var i = 0; i < list.length; i++) {
						var name = list[i];
						if (
							player.countCards("hes", function (card) {
								return (name != "sha" || get.value(card) < 5) && get.suit(card, player) == map[name];
							}) > 0 &&
							player.getUseValue({
								name: name,
								nature: name == "sha" ? "fire" : null,
							}) > 0
						) {
							var temp = get.order({
								name: name,
								nature: name == "sha" ? "fire" : null,
							});
							if (temp > max) max = temp;
						}
					}
					max /= 1.1;
					return max;
				}
				return 2;
			},
		},
		hiddenCard(player, name) {
			if ((player.getStat("skill").dclonghun || 0) >= 20) return false;
			if (name == "wuxie" && _status.connectMode && player.countCards("hes") > 0) return true;
			if (name == "wuxie") return player.countCards("hes", { suit: "spade" }) > 0;
			if (name == "tao") return player.countCards("hes", { suit: "heart" }) > 0;
		},
	},
	dczhanjiang: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				return target.countCards("ej", card => get.name(card, false) == "qinggang" || get.name(card, get.owner(card)) == "qinggang");
			});
		},
		content() {
			let cards = [],
				targets = game.filterPlayer(target => {
					return target.countCards("ej", card => get.name(card, false) == "qinggang" || get.name(card, get.owner(card)) == "qinggang");
				});
			targets.forEach(target => cards.addArray(target.getCards("ej", card => get.name(card, false) == "qinggang" || get.name(card, get.owner(card)) == "qinggang")));
			player.gain(cards, "give");
		},
	},
	//孙策
	//双壁=100%技能周瑜+100%原画孙策
	dcshuangbi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		*content(event, map) {
			var player = map.player,
				num = game.countPlayer();
			var result = yield player
				.chooseControl()
				.set("choiceList", ["摸" + get.cnNumber(num) + "张牌，本回合手牌上限+" + parseFloat(num), "弃置至多" + get.cnNumber(num) + "张牌，随机对其他角色造成等量火焰伤害", "视为使用" + get.cnNumber(num) + "张火【杀】或【火攻】"])
				.set("ai", () => {
					var player = _status.event.player,
						card = { name: "sha", nature: "fire" };
					if (!game.hasPlayer(target => player.canUse(card, target) && get.effect(target, card, player, player) > 0)) return 0;
					return 2;
				});
			player.flashAvatar("dcshuangbi", ["re_zhouyu", "shen_zhouyu", "dc_sb_zhouyu"][result.index]);
			switch (result.index) {
				case 0:
					player.draw(num);
					player.addTempSkill("dcshuangbi_effect");
					player.addMark("dcshuangbi_effect", num, false);
					break;
				case 1:
					var result2 = yield player.chooseToDiscard("双壁：弃置至多" + get.cnNumber(num) + "张牌，随机对其他角色造成等量火焰伤害", [1, num], "he").set("ai", card => 1 / (get.value(card) || 0.5));
					if (result2.bool) {
						var map = {},
							sum = result2.cards.length;
						var targets = game.filterPlayer(target => target != player);
						if (targets.length) {
							while (sum) {
								sum--;
								var target = targets.randomGet();
								player.line(target);
								target.damage(1, "fire");
								game.delayx();
							}
						}
					}
					break;
				case 2:
					while (num && game.hasPlayer(target => player.canUse({ name: "sha", nature: "fire" }, target) || player.canUse({ name: "huogong" }, target))) {
						num--;
						var list = [];
						if (game.hasPlayer(target => player.canUse({ name: "sha", nature: "fire" }, target))) list.push(["基本", "", "sha", "fire"]);
						if (game.hasPlayer(target => player.canUse({ name: "huogong" }, target))) list.push(["锦囊", "", "huogong"]);
						var result2 = yield player.chooseButton(["双壁：请选择你要使用的牌", [list, "vcard"]], true).set("ai", button => (button.link[2] == "sha" ? 1 : 0));
						if (result2.bool) {
							var card = {
								name: result2.links[0][2],
								nature: result2.links[0][3],
							};
							yield player.chooseUseTarget(true, card, false);
						} else break;
					}
					break;
			}
		},
		ai: {
			order: 9,
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("dcshuangbi_effect");
					},
				},
			},
		},
	},
	//哪吒
	dcsantou: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		forced: true,
		*content(event, map) {
			var player = map.player,
				trigger = map.trigger;
			var source = trigger.source;
			trigger.cancel();
			var hp = player.getHp();
			var lose = false;
			if (hp >= 3) {
				if (
					player.hasHistory("useSkill", evt => {
						var evtx = evt.event;
						return evt.skill == "dcsantou" && evtx.getTrigger().source == source && evtx.getParent(2) != trigger;
					})
				)
					lose = true;
			} else if (hp == 2) {
				if (trigger.hasNature()) lose = true;
			} else if (hp == 1) {
				if (trigger.card && get.color(trigger.card) == "red") lose = true;
			}
			if (lose) player.loseHp();
		},
		ai: {
			filterDamage: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.player && arg.player.hasSkillTag("jueqing", false, player)) return false;
			},
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) return;
					if (player._dcsantou_temp) return;
					if (get.tag(card, "damage")) {
						const hp = target.getHp();
						player._dcsantou_temp = true;
						const losehp = get.effect(target, { name: "losehp" }, target, target) / get.attitude(target, target);
						delete player._dcsantou_temp;
						if (hp >= 3) {
							if (target.hasHistory("useSkill", evt => evt.skill == "dcsantou" && evt.event.getTrigger().source == player)) return [0, losehp, 0, 0];
							else if (get.attitude(player, target) < 0) {
								let hs = player.getCards("hs", i => {
										return i !== card && (!card.cards || !card.cards.includes(i));
									}),
									num = player.getCardUsable("sha");
								if (card.name === "sha") num--;
								hs = hs.filter(i => {
									if (!player.canUse(i, target)) return false;
									if (get.tag(card, "damage") && get.name(i, player) !== "sha") return true;
									if (num) {
										num--;
										return true;
									}
									return false;
								}).length;
								if (
									player.hasSkillTag("damage", null, {
										target: target,
									})
								)
									hs++;
								if (!hs) return "zeroplayertarget";
								num = 1 - 2 / 3 / hs;
								return [num, 0, num, 0];
							}
						}
						if ((hp == 2 && get.tag(card, "natureDamage")) || (hp == 1 && typeof card == "object" && get.color(card) == "red")) return [0, losehp, 0, 0];
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	dcfaqi: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (get.type(event.card) != "equip") return false;
			if (!player.isPhaseUsing()) return false;
			for (const name of lib.inpile) {
				if (get.type(name) != "trick") continue;
				if (!player.hasStorage("dcfaqi", name) && player.hasUseTarget({ name: name, isCard: true })) return true;
			}
			return false;
		},
		direct: true,
		*content(event, map) {
			var player = map.player;
			var list = get.inpileVCardList(info => {
				if (info[0] != "trick") return false;
				var name = info[2];
				return !player.hasStorage("dcfaqi", name) && player.hasUseTarget({ name: name, isCard: true });
			});
			if (list.length) {
				var result = yield player.chooseButton(["法器：视为使用一张普通锦囊牌", [list, "vcard"]], true).set("ai", button => {
					return get.player().getUseValue({ name: button.link[2] });
				});
				if (result.bool) {
					var name = result.links[0][2];
					if (!player.storage.dcfaqi) player.when({ global: "phaseAfter" }).then(() => delete player.storage.dcfaqi);
					player.markAuto("dcfaqi", name);
					player.chooseUseTarget({ name: name, isCard: true }, true, false).logSkill = "dcfaqi";
				}
			} else event.finish();
		},
		ai: {
			reverseEquip: true,
		},
	},
	//隅泣曹操
	dcjianxiong: {
		audio: "rejianxiong",
		trigger: {
			player: "damageEnd",
		},
		async content(event, trigger, player) {
			if (get.itemtype(trigger.cards) == "cards" && get.position(trigger.cards[0], true) == "o") {
				await player.gain(trigger.cards, "gain2");
			}
			await player.draw(player.countMark("dcjianxiong") + 1, "nodelay");
			if (player.countMark("dcjianxiong") < 4) player.addMark("dcjianxiong", 1, false);
		},
		marktext: "雄",
		intro: {
			markcount(storage, player) {
				return player.countMark("dcjianxiong") + 1;
			},
			content(storage, player) {
				return "摸牌数为" + (player.countMark("dcjianxiong") + 1);
			},
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) return [1, -1];
					if (get.tag(card, "damage") && player != target) {
						var cards = card.cards,
							evt = _status.event;
						if (evt.player == target && card.name == "damage" && evt.getParent().type == "card") cards = evt.getParent().cards.filterInD();
						if (target.hp <= 1) return;
						if (get.itemtype(cards) != "cards") return;
						for (var i of cards) {
							if (get.name(i, target) == "tao") return [1, 5 + player.countMark("dcjianxiong") / 2];
						}
						if (get.value(cards, target) >= 7 - player.countMark("dcjianxiong") / 2 + target.getDamagedHp()) return [1, 3 + player.countMark("dcjianxiong") / 2];
						return [1, 0.6 + player.countMark("dcjianxiong") / 2];
					}
				},
			},
		},
	},
	//缺德刘备
	dcrende: {
		audio: "rerende",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => {
				return lib.skill.dcrende.filterTarget(null, player, current);
			});
		},
		discard: false,
		lose: false,
		delay: false,
		filterTarget(card, player, target) {
			if (player.getStorage("dcrende_targeted").includes(target)) return false;
			return player != target && target.countGainableCards(player, "h") > 1;
		},
		async content(event, trigger, player) {
			player.addTempSkill("dcrende_targeted", "phaseUseAfter");
			player.markAuto("dcrende_targeted", [event.target]);
			await player.gainPlayerCard(event.target, "h", true, 2);
			var list = [];
			for (var name of lib.inpile) {
				if (get.type(name) != "basic") continue;
				var card = { name: name, isCard: true };
				if (
					lib.filter.cardUsable(card, player, event.getParent("chooseToUse")) &&
					game.hasPlayer(current => {
						return player.canUse(card, current);
					})
				) {
					list.push(["基本", "", name]);
				}
				if (name == "sha") {
					for (var nature of lib.inpile_nature) {
						card.nature = nature;
						if (
							lib.filter.cardUsable(card, player, event.getParent("chooseToUse")) &&
							game.hasPlayer(current => {
								return player.canUse(card, current);
							})
						) {
							list.push(["基本", "", name, nature]);
						}
					}
				}
			}
			if (list.length) {
				const result = await player
					.chooseButton(["是否视为使用一张基本牌？", [list, "vcard"]])
					.set("ai", function (button) {
						var player = _status.event.player;
						var card = {
							name: button.link[2],
							nature: button.link[3],
							isCard: true,
						};
						if (card.name == "tao") {
							if (player.hp == 1 || (player.hp == 2 && !player.hasShan()) || player.needsToDiscard()) return 5;
							return 1;
						}
						if (card.name == "sha") {
							if (
								game.hasPlayer(function (current) {
									return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
								})
							) {
								if (card.nature == "fire") return 2.95;
								if (card.nature == "thunder" || card.nature == "ice") return 2.92;
								return 2.9;
							}
							return 0;
						}
						if (card.name == "jiu") {
							return 0.5;
						}
						return 0;
					})
					.forResult();
				if (result && result.bool && result.links[0]) {
					var card = {
						name: result.links[0][2],
						nature: result.links[0][3],
						isCard: true,
					};
					await player.chooseUseTarget(card, true);
				}
			}
		},
		subSkill: {
			targeted: {
				onremove: true,
				charlotte: true,
			},
		},
		ai: {
			fireAttack: true,
			order(skill, player) {
				return 10;
			},
			result: {
				target(player, target) {
					if (target.hasSkillTag("noh")) return -0.1;
					return -2;
				},
			},
			threaten: 3,
		},
	},
	//会玩孙权
	dczhiheng: {
		audio: "rezhiheng",
		init: player => {
			player.storage.dczhiheng_hit = [];
		},
		enable: "phaseUse",
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		discard: false,
		lose: false,
		delay: false,
		selectCard: [1, Infinity],
		filter(event, player) {
			var skill = player.getStat().skill;
			return !skill.dczhiheng || skill.dczhiheng < 1 + player.getStorage("dczhiheng_hit").length;
		},
		check(card) {
			var player = _status.event.player;
			if (
				get.position(card) == "h" &&
				!player.countCards("h", "du") &&
				(player.hp > 2 ||
					!player.countCards("h", function (card) {
						return get.value(card) >= 8;
					}))
			) {
				return 1;
			}
			return 6 - get.value(card);
		},
		group: "dczhiheng_add",
		async content(event, trigger, player) {
			let num = 1;
			var hs = player.getCards("h");
			if (!hs.length) num = 0;
			else {
				for (var i = 0; i < hs.length; i++) {
					if (!event.cards.includes(hs[i])) {
						num = 0;
						break;
					}
				}
			}
			await player.discard(event.cards);
			await player.draw(num + event.cards.length);
		},
		subSkill: {
			add: {
				audio: "rezhiheng",
				trigger: {
					source: "damageSource",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					return !player.getStorage("dczhiheng_hit").includes(event.player);
				},
				content() {
					player.addTempSkill("dczhiheng_hit");
					player.markAuto("dczhiheng_hit", [trigger.player]);
				},
			},
			hit: {
				charlotte: true,
				onremove: player => {
					player.storage.dczhiheng_hit = [];
				},
				mark: true,
				marktext: "衡",
				intro: {
					markcount(storage) {
						if (storage) return storage.length;
						return 0;
					},
					content: "本回合已对$造成过伤害",
				},
			},
		},
		ai: {
			order(item, player) {
				if (
					player.hasCard(i => {
						return get.value(i) > Math.max(6, 9 - player.hp);
					}, "he")
				)
					return 1;
				return 10;
			},
			result: {
				player: 1,
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep")
					return (
						(!arg || (arg && arg.card && get.name(arg.card) === "tao")) &&
						player.isPhaseUsing() &&
						player.countSkill("dczhiheng") < 1 + player.getStorage("dczhiheng_hit").length &&
						player.hasCard(card => {
							return get.name(card) !== "tao";
						}, "h")
					);
			},
			threaten: 1.55,
		},
	},
	//朱铁雄
	dcbianzhuang: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			var list = [];
			for (var i in lib.skill.dcbianzhuang.characterMap) {
				if (lib.character[i] && get.is.object(lib.skill[lib.skill.dcbianzhuang.characterMap[i]])) list.push(i);
			}
			var characters = list.randomGets(player.storage.dcbianzhuang_inited ? 3 : 2);
			if (!characters.length) {
				event.finish();
				return;
			}
			var skills = characters.map(i => lib.skill.dcbianzhuang.characterMap[i]);
			const result = await player
				.chooseControl(skills)
				.set("dialog", ["选择获得一个技能并“变装”", [characters, "character"]])
				.forResult();
			var skill = result.control;
			await player.addTempSkills(skill, "dcbianzhuangAfter");
			for (var i in lib.skill.dcbianzhuang.characterMap) {
				if (lib.skill.dcbianzhuang.characterMap[i] == skill) {
					player.flashAvatar("dcbianzhuang", i);
					player.popup(skill);
					game.log(player, "“变装”为了", "#b" + get.translation(i));
					break;
				}
			}
			const result2 = await player.chooseUseTarget("sha", true, false, "nodistance").forResult();
			if (result2.bool && !player.storage.dcbianzhuang_inited) {
				player.addMark("dcbianzhuang", 1, false);
				if (player.countMark("dcbianzhuang") > 2) {
					player.storage.dcbianzhuang_inited = true;
					await player.reinitCharacter(get.character(player.name2, 3).includes("dcbianzhuang") ? player.name2 : player.name1, "wu_zhutiexiong");
				}
			}
		},
		group: "dcbianzhuang_refresh",
		ai: {
			order: 16,
			result: {
				player(player) {
					if (player.hasValueTarget("sha", false)) return 1;
					return 0;
				},
			},
			effect: {
				target_use(card, player, target, current) {
					if (player == target && player.isPhaseUsing() && get.type(card) == "equip") {
						if (player.hasValueTarget("sha", false) && typeof player.getStat("skill").dcbianzhuang == "number") return [1, 3];
					}
				},
			},
		},
		subSkill: {
			refresh: {
				trigger: { player: "useCardAfter" },
				forced: true,
				filter(event, player) {
					return get.type2(event.card, false) == "equip" && typeof player.getStat("skill").dcbianzhuang == "number";
				},
				content() {
					var stat = player.getStat("skill");
					delete stat.dcbianzhuang;
				},
			},
		},
		characterMap: {
			re_zhangchunhua: "rejueqing",
			wangshuang: "spzhuilie",
			re_machao: "retieji",
			ol_weiyan: "xinkuanggu",
			re_lvbu: "wushuang",
			re_huangzhong: "xinliegong",
			ol_pangde: "rejianchu",
			ol_zhurong: "lieren",
			re_masu: "rezhiman",
			re_panzhangmazhong: "reanjian",
			mayunlu: "fengpo",
			re_quyi: "refuqi",
		},
	},
	//小约翰可汗
	dctongliao: {
		audio: 3,
		trigger: { player: "phaseDrawAfter" },
		direct: true,
		locked: false,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseCard("h", get.prompt("dctongliao"), "选择一张牌标记为“通辽”", function (card, player) {
					if (card.hasGaintag("dctongliao")) return false;
					var num = get.number(card, player);
					return !player.hasCard(card2 => {
						return card != card2 && get.number(card2, player) < num;
					});
				})
				.set("ai", function (card) {
					var player = _status.event.player;
					return 1 + Math.max(0, player.getUseValue(card, null, true));
				})
				.forResult();
			if (result.bool) {
				await player.logSkill("dctongliao");
				player.addGaintag(result.cards, "dctongliao");
				await game.asyncDelayx();
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dctongliao")) return num + 0.6;
			},
		},
		group: "dctongliao_draw",
		subSkill: {
			draw: {
				trigger: {
					player: ["loseAfter"],
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					var evt = event.getl(player);
					if (!evt || !evt.hs || !evt.hs.length) return false;
					if (event.name == "lose") {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("dctongliao")) return true;
						}
						return false;
					}
					return player.hasHistory("lose", function (evt) {
						if (event != evt.getParent()) return false;
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dctongliao")) return true;
						}
						return false;
					});
				},
				forced: true,
				content() {
					var num = 0;
					var cards = trigger.getl(player).hs,
						ids = [];
					if (trigger.name == "lose") {
						for (var i in trigger.gaintag_map) {
							if (trigger.gaintag_map[i].includes("dctongliao")) ids.push(i);
						}
					} else
						player.getHistory("lose", function (evt) {
							if (trigger != evt.getParent()) return false;
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("dctongliao")) ids.push(i);
							}
						});
					for (var card of cards) {
						if (ids.includes(card.cardid)) num += get.number(card, player);
					}
					if (num > 0) player.draw(num);
				},
			},
		},
	},
	dcwudao: {
		audio: 3,
		trigger: { player: "useCardAfter" },
		frequent: true,
		filter(event, player) {
			if (player.getStorage("dcwudao_effect").includes(get.type2(event.card, false))) return false;
			var history = player.getHistory("useCard"),
				index = history.indexOf(event);
			if (index < 1) return false;
			var evt = history[index - 1];
			return get.type2(event.card, false) == get.type2(evt.card, false);
		},
		prompt2(event) {
			return "令你本回合使用" + get.translation(get.type2(event.card, false)) + "牌时不可被响应且伤害+1";
		},
		content() {
			player.addTempSkill("dcwudao_effect");
			player.markAuto("dcwudao_effect", [get.type2(trigger.card, false)]);
		},
		subSkill: {
			effect: {
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return player.getStorage("dcwudao_effect").includes(get.type2(event.card, false));
				},
				content() {
					if (get.tag(trigger.card, "damage") > 0) trigger.baseDamage++;
					trigger.directHit.addArray(game.filterPlayer());
				},
				intro: { content: "已经悟到了$牌" },
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg && arg.card && player.getStorage("dcwudao_effect").includes(get.type2(arg.card))) return true;
						return false;
					},
				},
			},
		},
	},
	//叶诗文
	clbjisu: {
		audio: 2,
		trigger: { player: "phaseJudgeBefore" },
		direct: true,
		async content(event, trigger, player) {
			var check = player.countCards("h") > 2;
			const result = await player
				.chooseTarget(get.prompt("clbjisu"), "跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】", function (card, player, target) {
					if (player == target) return false;
					return player.canUse({ name: "sha" }, target, false);
				})
				.set("check", check)
				.set("ai", function (target) {
					if (!_status.event.check) return 0;
					return get.effect(target, { name: "sha" }, _status.event.player);
				})
				.setHiddenSkill("clbjisu")
				.forResult();
			if (result.bool) {
				await player.useCard({ name: "sha", isCard: true }, result.targets[0], false, "clbjisu");
				trigger.cancel();
				player.skip("phaseDraw");
			}
		},
	},
	clbshuiyong: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		filter(event) {
			return event.hasNature("fire");
		},
		forced: true,
		content() {
			trigger.cancel();
		},
		ai: {
			nofire: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "fireDamage")) return "zerotarget";
				},
			},
		},
	},
	//孙杨
	clbshuijian: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		frequent: true,
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			var num = 1 + Math.floor(player.countCards("e") / 2);
			trigger.num += num;
		},
	},
	//李白
	dclbjiuxian: {
		audio: 2,
		enable: "chooseToUse",
		locked: false,
		viewAs: { name: "jiu" },
		check: card => 6.5 - get.value(card),
		filterCard(card) {
			var info = get.info(card);
			if (!info || (info.type != "trick" && info.type != "delay")) return false;
			if (info.notarget) return false;
			if (info.selectTarget != undefined) {
				if (Array.isArray(info.selectTarget)) {
					if (info.selectTarget[0] < 0) return !info.toself;
					return info.selectTarget[0] != 1 || info.selectTarget[1] != 1;
				} else {
					if (info.selectTarget < 0) return !info.toself;
					return info.selectTarget != 1;
				}
			}
			return false;
		},
		viewAsFilter(player) {
			if (_status.connectMode && player.countCards("hs") > 0) return true;
			return player.hasCard(lib.skill.dclbjiuxian.filterCard, "hs");
		},
		ai: {
			order: (item, player) => get.order({ name: "jiu" }, player),
		},
		mod: {
			cardUsable(card) {
				if (card.name == "jiu") return Infinity;
			},
		},
	},
	dcshixian: {
		audio: 2,
		trigger: { player: "useCard" },
		//frequent:true,
		//direct:true,
		locked: false,
		filter(event, player) {
			var history = player.getAllHistory("useCard"),
				index = history.indexOf(event);
			if (index < 1) return false;
			var evt = history[index - 1];
			return get.is.yayun(get.translation(event.card.name), get.translation(evt.card.name));
		},
		filterx(event) {
			if (event.targets.length == 0) return false;
			var type = get.type(event.card);
			if (type != "basic" && type != "trick") return false;
			return true;
		},
		prompt2(event, player) {
			if (lib.skill.dcshixian.filterx(event)) return "摸一张牌并令" + get.translation(event.card) + "额外结算一次？";
			return "摸一张牌。";
		},
		check(event, player) {
			if (lib.skill.dcshixian.filterx(event)) return !get.tag(event.card, "norepeat");
			return true;
		},
		content() {
			player.draw();
			if (lib.skill.dcshixian.filterx(trigger)) {
				trigger.effectCount++;
				game.log(trigger.card, "额外结算一次");
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && !get.tag(card, "norepeat")) {
					var history = player.getAllHistory("useCard");
					if (history.length > 0) {
						var cardx = history[history.length - 1].card;
						if (get.is.yayun(get.translation(cardx.name), get.translation(card.name))) return num + 20;
					}
				}
			},
		},
		init(player) {
			player.addSkill("dcshixian_yayun");
			var history = player.getAllHistory("useCard");
			if (history.length) {
				player.addGaintag(
					player.getCards("h", card => {
						return get.is.yayun(get.translation(card.name), get.translation(history[history.length - 1].card.name));
					}),
					"dcshixian_yayun"
				);
			}
		},
		onremove(player) {
			player.removeSkill("dcshixian_yayun");
			player.removeGaintag("dcshixian_yayun");
		},
		subSkill: {
			yayun: {
				charlotte: true,
				trigger: { player: "useCard1" },
				filter(event, player) {
					return player.countCards("h") > 0;
				},
				direct: true,
				priority: 11 + 45 + 14 + 19 + 19 + 810,
				content() {
					player.removeGaintag("dcshixian_yayun");
					player.addGaintag(
						player.getCards("h", card => {
							return get.is.yayun(get.translation(card.name), get.translation(trigger.card.name));
						}),
						"dcshixian_yayun"
					);
				},
			},
		},
	},
	//龙王
	dclonggong: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		usable: 1,
		filter(event, player) {
			return event.source && event.source.isIn();
		},
		logTarget: "source",
		check(event, player) {
			return get.attitude(player, event.source) >= 0 || player.hp <= Math.max(2, event.num);
		},
		async content(event, trigger, player) {
			trigger.cancel();
			var card = get.cardPile2(function (card) {
					return get.type(card, null, false) == "equip";
				}),
				source = trigger.source;
			if (card && source && source.isIn()) await source.gain(card, "gain2");
		},
		ai: {
			filterDamage: true,
			skillTagFilter(player) {
				return !player.storage.counttrigger || !player.storage.counttrigger.dclonggong;
			},
		},
	},
	dcsitian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			var colorx = false,
				hs = player.getCards("he");
			if (hs.length < 2) return false;
			for (var card of hs) {
				if (!lib.filter.cardDiscardable(card, player)) continue;
				var color = get.color(card, player);
				if (color == "none") continue;
				if (!colorx) colorx = color;
				else if (colorx != color) return true;
			}
			return false;
		},
		filterCard(card, player) {
			var color = get.color(card, player);
			if (color == "none") return false;
			return !ui.selected.cards.length || get.color(ui.selected.cards[0]) != color;
		},
		selectCard: 2,
		complexCard: true,
		prompt: "弃置两张颜色不同的牌并改变天气",
		check: card => 4.5 - get.value(card),
		async content(event, trigger, player) {
			var list = ["烈日", "雷电", "大浪", "暴雨", "大雾"].randomGets(2);
			const result = await player
				.chooseButton(true, ["请选择执行一个天气", [list.map(i => [i, '<div class="popup text" style="width:calc(100% - 10px);display:inline-block"><div class="skill">【' + i + "】</div><div>" + lib.skill.dcsitian.weathers[i].description + "</div></div>"]), "textbutton"]])
				.set("ai", function (button) {
					return lib.skill.dcsitian.weathers[button.link].ai(_status.event.player);
				})
				.forResult();
			if (result.bool) {
				var choice = result.links[0];
				game.log(player, "将当前天气变更为", "#g" + choice);
				var next = game.createEvent("dcsitian_weather", false);
				next.player = player;
				next.setContent(lib.skill.dcsitian.weathers[choice].content);
			}
		},
		ai: {
			order: 8,
			result: {
				player(player) {
					var num1 = 0,
						num2 = 0;
					game.countPlayer(function (current) {
						if (player == current) return;
						var att = get.attitude(player, current);
						if (att > 0) num1++;
						else num2++;
					});
					return num2 - num1;
				},
			},
		},
		subSkill: {
			dawu: {
				trigger: { player: "useCard" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return get.type2(event.card, false) == "basic";
				},
				content() {
					trigger.targets.length = 0;
					trigger.all_excluded = true;
					player.removeSkill("dcsitian_dawu");
				},
				mark: true,
				marktext: "雾",
				intro: {
					name: "司天 - 大雾",
					content: "使用的下一张基本牌无效",
				},
			},
		},
		weathers: {
			烈日: {
				description: "你对其他角色造成1点火属性伤害。",
				content() {
					var targets = game.filterPlayer(current => current != player).sortBySeat();
					player.line(targets, "fire");
					for (var target of targets) {
						target.damage("fire");
					}
				},
				ai(player) {
					var effect = 0;
					game.countPlayer(function (current) {
						if (current == player) return;
						effect += get.damageEffect(current, player, player, "fire");
					});
					return effect;
				},
			},
			雷电: {
				description: "你令其他角色各进行一次判定。若结果为♠2~9，则其受到3点无来源雷属性伤害。",
				async content(event, trigger, player) {
					var targets = game.filterPlayer(current => current != player).sortBySeat();
					player.line(targets, "thunder");
					for (const target of targets) {
						if (!target.isIn()) continue;
						const result = await target.judge(lib.card.shandian.judge, get.translation("shandian")).set("judge2", lib.card.shandian.judge2).forResult();
						var name = "shandian";
						if (event.cancelled && !event.direct) {
							if (lib.card[name].cancel) {
								var next = game.createEvent(name + "Cancel");
								next.setContent(lib.card[name].cancel);
								next.cards = [];
								next.card = get.autoViewAs({ name: name });
								next.player = target;
								await next;
							}
						} else {
							var next = game.createEvent(name);
							next.setContent(function () {
								if (result.bool == false) {
									player.damage(3, "thunder", "nosource");
								}
							});
							next._result = result;
							next.cards = [];
							next.card = get.autoViewAs({ name: name });
							next.player = target;
							await next;
						}
					}
				},
				ai(player) {
					var effect = 0;
					game.countPlayer(function (current) {
						if (current == player) return;
						effect += get.damageEffect(current, current, player, "thunder") / 5;
					});
					return effect;
				},
			},
			大浪: {
				description: "你弃置其他角色装备区内的所有牌（装备区内没有牌的角色改为失去1点体力）。",
				async content(event, trigger, player) {
					var targets = game.filterPlayer(current => current != player).sortBySeat();
					player.line(targets, "green");
					for (const target of targets) {
						if (target.isIn()) {
							var num = target.countCards("e");
							if (num > 0) {
								await player.discardPlayerCard(target, true, "e", num);
							} else {
								await target.loseHp();
								await game.asyncDelayx();
							}
						}
					}
				},
				ai(player) {
					var effect = 0;
					game.countPlayer(function (current) {
						if (current == player) return;
						var es = current.getCards("e");
						if (es.length > 0) {
							var att = get.attitude(player, current),
								val = get.value(es, current);
							effect -= Math.sqrt(att) * val;
						} else effect += get.effect(current, { name: "losehp" }, player, player);
					});
					return effect;
				},
			},
			暴雨: {
				description: "你弃置一名角色的所有手牌。若其没有手牌，则改为令其失去1点体力。",
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget("请选择【暴雨】的目标", "令目标角色弃置所有手牌。若其没有手牌，则其改为失去1点体力。")
						.set("ai", function (current) {
							var es = current.getCards("h"),
								player = _status.event.player;
							if (es.length > 0) {
								var att = get.attitude(player, current),
									val = get.value(es, current);
								return -Math.sqrt(att) * val;
							}
							return get.effect(current, { name: "losehp" }, player, player);
						})
						.forResult();
					if (result.bool) {
						var target = result.targets[0];
						player.line(target, "green");
						var num = target.countCards("h");
						if (num > 0) {
							player.discardPlayerCard(target, true, "h", num);
						} else {
							target.loseHp();
							game.delayex();
						}
					}
				},
				ai(player) {
					return Math.max.apply(
						Math,
						game
							.filterPlayer(function (current) {
								return current != player;
							})
							.map(function (current) {
								var es = current.getCards("h");
								if (es.length > 0) {
									var att = get.attitude(player, current),
										val = get.value(es, current);
									return -Math.sqrt(att) * val;
								}
								return get.effect(current, { name: "losehp" }, player, player);
							})
					);
				},
			},
			大雾: {
				description: "你令所有其他角色获得如下效果：当其使用下一张基本牌时，取消之。",
				content() {
					var targets = game.filterPlayer(current => current != player).sortBySeat();
					player.line(targets);
					for (var target of targets) target.addSkill("dcsitian_dawu");
				},
				ai(player) {
					var effect = 0;
					game.countPlayer(function (current) {
						if (current == player || current.hasSkill("dcsitian_dawu")) return;
						effect -= 0.5 * get.attitude(player, current);
					});
					return effect;
				},
			},
		},
	},
	//美猴王
	dcjinjing: {
		locked: true,
		ai: {
			viewHandcard: true,
			skillTagFilter(player, tag, arg) {
				if (player == arg) return false;
			},
		},
	},
	dccibei: {
		audio: 2,
		trigger: { source: "damageBegin2" },
		logTarget: "player",
		filter(event, player) {
			return (
				player != event.player &&
				!player.hasHistory("useSkill", function (evt) {
					return evt.skill == "dccibei" && evt.targets.includes(event.player);
				})
			);
		},
		check(event, player) {
			var target = event.player;
			if (get.attitude(player, target) >= 0) return true;
			return !player.getStat("skill").ruyijingubang_skill || player.storage.ruyijingubang_skill == 1;
		},
		content() {
			trigger.cancel();
			player.draw(5);
		},
		ai: {
			threaten: 4.5,
		},
	},
	dcruyi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasEquipableSlot(1) && !player.getEquips("ruyijingubang").length;
		},
		content() {
			var card = game.createCard2("ruyijingubang", "heart", 9);
			player.$gain2(card, false);
			game.delayx();
			player.equip(card);
		},
		mod: {
			canBeGained(card, source, player) {
				if (player.getEquips("ruyijingubang").includes(card)) return false;
			},
			canBeDiscarded(card, source, player) {
				if (player.getEquips("ruyijingubang").includes(card)) return false;
			},
			canBeReplaced(card, player) {
				if (player.getEquips("ruyijingubang").includes(card)) return false;
			},
			cardname(card) {
				if (get.subtype(card, false) == "equip1") return "sha";
			},
			cardnature(card) {
				if (get.subtypes(card, false).includes("equip1")) return false;
			},
			cardDiscardable(card, player) {
				if (player.getEquips("ruyijingubang").includes(card)) return false;
			},
			cardEnabled2(card, player) {
				if (player.getEquips("ruyijingubang").includes(card)) return false;
			},
		},
		group: "dcruyi_blocker",
		subSkill: {
			blocker: {
				trigger: {
					player: ["loseBefore", "disableEquipBefore"],
				},
				forced: true,
				filter(event, player) {
					if (event.name == "disableEquip") return event.slots.includes("equip1");
					var cards = player.getEquips("ruyijingubang");
					return event.cards.some(card => cards.includes(card));
				},
				content() {
					if (trigger.name == "lose") {
						trigger.cards.removeArray(player.getEquips("ruyijingubang"));
					} else {
						while (trigger.slots.includes("equip1")) trigger.slots.remove("equip1");
					}
				},
			},
		},
	},
	ruyijingubang_skill: {
		equipSkill: true,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog() {
				var dialog = ui.create.dialog(
					"如意金箍棒：选择变化攻击范围",
					[
						[
							[1, "　　　⒈【杀】无次数限制　　　"],
							[2, "　　　⒉【杀】的伤害值+1　　　"],
						],
						"tdnodes",
					],
					[
						[
							[3, "　　　⒊【杀】不可被响应　　　"],
							[4, "　　　⒋【杀】的目标数+1　　　"],
						],
						"tdnodes",
					]
				);
				return dialog;
			},
			filter(button, player) {
				return button.link != player.storage.ruyijingubang_skill;
			},
			check(button) {
				if (button.link == 1 || button.link == 3) return 1;
				return 0;
			},
			backup(links, player) {
				return {
					audio: "dcruyi",
					num: links[0],
					popup: "如意金箍棒",
					content() {
						var num = lib.skill.ruyijingubang_skill_backup.num;
						player.storage.ruyijingubang_skill = num;
						var cards = player.getEquips(1);
						for (var card of cards) {
							if (card && card.name == "ruyijingubang") {
								card.storage.ruyijingubang_skill = num;
								game.log(player, "将", card, "的攻击范围改为" + num);
							}
						}
						player.markSkill("ruyijingubang_skill");
					},
				};
			},
		},
		mod: {
			cardUsable(card, player, num) {
				if (player.storage.ruyijingubang_skill == 1 && card.name == "sha") return Infinity;
			},
		},
		ai: {
			order: 1,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return player.storage.ruyijingubang_skill == 3;
			},
			effect: {
				player(card, player, target, current) {
					if (get.tag(card, "damage") > 0 && player != target) {
						if (player.getStat("skill").ruyijingubang_skill && player.storage.ruyijingubang_skill != 1) return;
						if (
							player.hasSkill("dccibei") &&
							!player.hasHistory("useSkill", function (evt) {
								return evt.skill == "dccibei" && evt.targets.includes(target);
							})
						) {
							return [1, 3];
						}
					}
				},
			},
			result: {
				player(player) {
					if (player.storage.ruyijingubang_skill == 1) {
						if (!player.hasSha()) return 1;
						return 0;
					} else {
						if (player.hasSha() && player.getCardUsable("sha") <= 0) return 1;
						return 0;
					}
				},
			},
		},
		intro: {
			name: "如意金箍棒",
			content(storage) {
				if (!storage) storage = 3;
				return "<li>攻击范围：" + storage + "<br><li>" + ["你使用【杀】无次数限制。", "你使用的【杀】伤害+1。", "你使用的【杀】不可被响应。", "你使用【杀】选择目标后，可以增加一个额外目标。"][storage - 1];
			},
		},
		subSkill: {
			backup: {},
		},
	},
	ruyijingubang_effect: {
		equipSkill: true,
		trigger: { player: "useCard2" },
		direct: true,
		locked: true,
		filter(event, player) {
			if (event.card.name != "sha") return false;
			var num = player.storage.ruyijingubang_skill;
			if (!num || num == 1) return false;
			if (num != 4) return true;
			var card = event.card;
			if (
				game.hasPlayer(function (current) {
					return !event.targets.includes(current) && lib.filter.targetEnabled2(card, player, current) && lib.filter.targetInRange(card, player, current);
				})
			) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			var num = player.storage.ruyijingubang_skill;
			if (num == 4) {
				const result = await player
					.chooseTarget(get.prompt("ruyijingubang_effect"), "为" + get.translation(trigger.card) + "额外指定一个目标", function (card, player, target) {
						return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target, false);
					})
					.set("sourcex", trigger.targets)
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, _status.event.card, player, player);
					})
					.set("card", trigger.card)
					.forResult();
				if (result.bool) {
					if (!event.isMine() && !event.isOnline()) await game.asyncDelayx();
					await player.logSkill("ruyijingubang_effect", result.targets);
					trigger.targets.addArray(result.targets);
				}
			} else {
				await player.logSkill("ruyijingubang_effect");
				if (num == 2) {
					trigger.baseDamage++;
					game.log(trigger.card, "的伤害+1");
				} else if (num == 3) {
					trigger.directHit.addArray(game.filterPlayer());
					game.log(trigger.card, "不可被响应");
				}
				return;
			}
		},
	},
	//涛神
	dcnutao: {
		audio: 4,
		trigger: { player: "useCardToPlayer" },
		forced: true,
		group: "dcnutao_add",
		filter(event, player) {
			if (get.type2(event.card) != "trick") return false;
			return event.isFirstTarget && event.targets.some(i => i != player);
		},
		content() {
			var target = trigger.targets.filter(i => i != player).randomGet();
			player.line(target, "thunder");
			target.damage("thunder");
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (player !== target && get.type2(card) === "trick") {
						let tars = [target];
						if (ui.selected.targets.length) tars.addArray(ui.selected.targets.filter(i => i !== player && i !== target));
						if (tars.length < 2) return [1, 0, 1, -2];
						return [1, 0, 1, -2 / tars.length];
					}
				},
			},
		},
		subSkill: {
			add: {
				audio: "dcnutao",
				trigger: { source: "damageSource" },
				filter(event, player) {
					return event.nature == "thunder" && player.isPhaseUsing();
				},
				forced: true,
				content() {
					player.addTempSkill("dcnutao_sha", "phaseUseAfter");
					player.addMark("dcnutao_sha", 1, false);
				},
			},
			sha: {
				charlotte: true,
				onremove: true,
				marktext: "涛",
				intro: {
					content: "此阶段使用【杀】的次数上限+#",
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") return num + player.countMark("dcnutao_sha");
					},
				},
			},
		},
	},
	//铜雀台
	spduanzhi: {
		trigger: { target: "useCardToTargeted" },
		logTarget: "player",
		check(event, player) {
			var target = event.player;
			if (
				get.attitude(player, target) >= -2 ||
				target.countCards("he", function (card) {
					return get.value(card, target) > 5;
				}) < 2
			)
				return false;
			if (player.hp > 2) return true;
			if (player.hp == 1) {
				if (get.tag(event.card, "respondSha")) {
					if (player.countCards("h", { name: "sha" }) == 0) {
						return true;
					}
				} else if (get.tag(event.card, "respondShan")) {
					if (player.countCards("h", { name: "shan" }) == 0) {
						return true;
					}
				} else if (get.tag(event.card, "damage")) {
					if (event.card.name == "shuiyanqijunx") return player.countCards("e") == 0;
					return true;
				}
			}
			return false;
		},
		filter(event, player) {
			return player != event.player && event.player.countDiscardableCards(player, "he") > 0;
		},
		content() {
			player.discardPlayerCard(trigger.player, true, "he", [1, 2]);
			player.loseHp();
		},
	},
	spduyi: {
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			const card = get.cards()[0];
			await game.cardsGotoOrdering(card);
			await player.showCards(card);
			const result = await player
				.chooseTarget("令一名角色获得" + get.translation(card), true)
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (_status.event.du) {
						if (target.hasSkillTag("nodu")) return 0;
						return -att;
					}
					if (att > 0) {
						if (target == player) att *= 0.6;
						return att + Math.sqrt(Math.max(0, 5 - target.countCards("h")));
					}
					return att;
				})
				.set("du", card.name == "du")
				.forResult();
			if (result.bool) {
				var target = result.targets[0];
				target.gain(card, "gain2");
				if (get.color(card, false) == "black") target.addTempSkill("spduyi2");
			}
		},
		ai: {
			order: 0.1,
			result: {
				player: 1,
			},
		},
	},
	spduyi2: {
		mod: {
			cardEnabled2(card) {
				if (get.position(card) == "h") return false;
			},
		},
		mark: true,
		intro: {
			content: "不能使用或打出手牌",
		},
	},
	spcangni: {
		audio: "zhuikong",
		trigger: { player: "phaseDiscardBegin" },
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseDrawRecover("###" + get.prompt("spcangni") + "###摸两张牌或回复1点体力，然后将武将牌翻面", 2)
				.set("logSkill", "spcangni")
				.forResult();
			if (result.control != "cancel2") await player.turnOver();
		},
		group: ["spcangni_gain", "spcangni_lose"],
		subSkill: {
			gain: {
				audio: "zhuikong",
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				usable: 1,
				filter(event, player) {
					return player.isTurnedOver() && player != _status.currentPhase && event.getg(player).length > 0;
				},
				check(event, player) {
					return get.attitude(player, _status.currentPhase) > 0;
				},
				logTarget() {
					return _status.currentPhase;
				},
				prompt2: "令该角色摸一张牌",
				content() {
					_status.currentPhase.draw();
				},
			},
			lose: {
				audio: "zhuikong",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (event.name == "gain" && player == event.player) return false;
					var evt = event.getl(player);
					if (!evt || !evt.cards2 || !evt.cards2.length) return false;
					return player.isTurnedOver() && player != _status.currentPhase && _status.currentPhase.countCards("he") > 0;
				},
				check(event, player) {
					var target = _status.currentPhase;
					var att = get.attitude(player, target);
					if (
						target.countCards("e", function (card) {
							return get.value(card, target) <= 0;
						})
					)
						return att > 0;
					return att < 0;
				},
				logTarget() {
					return _status.currentPhase;
				},
				prompt2: "令该角色弃置一张牌",
				content() {
					_status.currentPhase.chooseToDiscard("he", true);
				},
			},
		},
	},
	spmixin: {
		audio: "qiuyuan",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0 && game.countPlayer() > 2;
		},
		filterCard: true,
		filterTarget: lib.filter.notMe,
		position: "h",
		selectTarget: 2,
		targetprompt: ["拿牌打人", "被打"],
		multitarget: true,
		delay: false,
		discard: false,
		lose: false,
		check(card) {
			if (card.name == "sha") return 4;
			return 4 - get.value(card);
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			await player.give(event.cards, targets[0]);
			if (!targets[0].isIn() || !targets[1].isIn()) {
				return;
			}
			const result = await targets[0]
				.chooseToUse(function (card, player, event) {
					if (get.name(card) != "sha") return false;
					return lib.filter.filterCard.apply(this, arguments);
				}, "密信：对" + get.translation(targets[1]) + "使用一张【杀】，或令其观看并获得你的一张手牌")
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) return false;
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", targets[1])
				.forResult();
			if (!result.bool && targets[0].countCards("h")) await targets[1].gainPlayerCard(targets[0], "visible", "h", true);
		},
		ai: {
			order: 1,
			expose: 0.1,
			result: {
				target(player, target) {
					var card = ui.selected.cards[0];
					if (!card) return 0;
					if (ui.selected.targets.length == 0) {
						if (card.name == "sha" || target.hasSha()) return 2;
						if (get.value(card, target) < 0) return -2;
						return 0;
					}
					var target1 = ui.selected.targets[0];
					if ((card.name == "sha" || target1.hasSha()) && get.effect(target, { name: "sha" }, target1, target1) > 0) return get.effect(target, { name: "sha" }, target1, target);
					return 1.5;
				},
			},
		},
	},
	spfengyin: {
		audio: "moukui",
		trigger: { global: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return (
				player != event.player &&
				event.player.hp >= player.hp &&
				player.countCards("h", function (card) {
					if (_status.connectMode) return true;
					return get.name(card, player) == "sha";
				}) > 0
			);
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseCard("h", get.prompt("spfengyin", trigger.player), "交给该角色一张【杀】并令其跳过出牌阶段和弃牌阶段", function (card, player) {
					return get.name(card, player) == "sha";
				})
				.set("ai", function (card) {
					if (_status.event.goon) return 5 - get.value(card);
					return 0;
				})
				.set(
					"goon",
					(function () {
						if (get.attitude(player, trigger.player) >= 0) return false;
						if (trigger.player.countCards("hs") < trigger.player.hp) return false;
						return true;
					})()
				)
				.forResult();
			if (result.bool) {
				var target = trigger.player;
				player.logSkill("spfengyin", target);
				player.give(result.cards, target, "give");
				target.skip("phaseUse");
				target.skip("phaseDiscard");
			}
		},
	},
	spchizhong: {
		mod: {
			maxHandcardBase(player, num) {
				return player.maxHp;
			},
		},
		trigger: { global: "dieAfter" },
		forced: true,
		content() {
			player.gainMaxHp();
		},
	},
	fenxin_old: {
		mode: ["identity"],
		trigger: { source: "dieBegin" },
		init(player) {
			player.storage.fenxin = false;
		},
		intro: {
			content: "limited",
		},
		skillAnimation: "epic",
		animationColor: "fire",
		unique: true,
		limited: true,
		audio: 2,
		mark: true,
		filter(event, player) {
			if (player.storage.fenxin) return false;
			return event.player.identity != "zhu" && player.identity != "zhu" && player.identity != "mingzhong" && event.player.identity != "mingzhong";
		},
		check(event, player) {
			if (player.identity == event.player.identity) return Math.random() < 0.5;
			var stat = get.situation();
			switch (player.identity) {
				case "fan":
					if (stat < 0) return false;
					if (stat == 0) return Math.random() < 0.6;
					return true;
				case "zhong":
					if (stat > 0) return false;
					if (stat == 0) return Math.random() < 0.6;
					return true;
				case "nei":
					if (event.player.identity == "fan" && stat < 0) return true;
					if (event.player.identity == "zhong" && stat > 0) return true;
					if (stat == 0) return Math.random() < 0.7;
					return false;
			}
			return false;
		},
		prompt(event, player) {
			return "焚心：是否与" + get.translation(event.player) + "交换身份？";
		},
		content() {
			game.broadcastAll(
				function (player, target, shown) {
					var identity = player.identity;
					player.identity = target.identity;
					if (shown || player == game.me) {
						player.setIdentity();
					}
					target.identity = identity;
				},
				player,
				trigger.player,
				trigger.player.identityShown
			);
			player.line(trigger.player, "green");
			player.storage.fenxin = true;
			player.awakenSkill("fenxin_old");
		},
	},
};

export default skills;
